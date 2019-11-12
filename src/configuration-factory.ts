import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as process from 'process';
import { IConfigurationFactory } from './i-configuration-factory';
import { IConfigurationDescriptor } from './i-configuration-descriptor';
import { ArgsLoader } from './loaders/args-loader';
import { ConfLoader } from './loaders/conf-loader';
import { EnvLoader } from './loaders/env-loader';
import { ConfSaver } from './savers/conf-saver';

export class ConfigurationFactory<T> {
    private static readonly HELP_COLUMN_NAME = 12;
    private static readonly HELP_COLUMN_TEXT = 68;

    /**
     * Calculate or give a pre-calculated configuration
     * @param factory Factory of configuration
     */
    public static get<T>(factory: IConfigurationFactory<T>): Promise<T> {
        if (factory.instance) {
            return factory.instance;
        }
        factory.instance = Promise.resolve().then(() => {
            factory.description.helpsParams = factory.description.helpsParams || {
                longNames: ["help"],
                shortNames: ["h"],
            };
            factory.description.savesParams = factory.description.savesParams || {
                longNames: ["save"],
                shortNames: [],
            };
            const loaders = factory.description.loaders || [new ArgsLoader(), new EnvLoader(), new ConfLoader()];
            return Promise.all(loaders.map(loader => {
                return loader.load(factory).then((result) => {
                    return {
                        loader: loader.loaderName,
                        loaderInstance: loader,
                        conf: result
                    };
                })
            })).then(sourcesConf => {
                // Check if help is asked
                const helpNames = factory.description.helpsParams.longNames.concat(factory.description.helpsParams.shortNames);
                const helpActionTrigger = helpNames.some(helpParam => {
                    return sourcesConf.some(sourceConf => {
                        if (!sourceConf.conf) {
                            return false;
                        }
                        if (sourceConf.conf[helpParam]) {
                            // Current help param found into this source
                            return true;
                        }
                    });
                });
                if (helpActionTrigger) {
                    // Show help
                    const helpFinally = factory.description.helpFinally || (help => {
                        console.log(help);
                        process.exit(0);
                        return Promise.resolve();
                    });
                    return helpFinally(ConfigurationFactory.formatHelp(factory)).then(() => sourcesConf);
                }
                return sourcesConf;
            }).then(sourcesConf => {
                //Parse configuration
                const missingConf: string[] = [];
                const finalConf: T = {} as T;
                const promisesToWait: Promise<void>[] = [];
                for (let key in factory.description.description) {
                    const descriptor = factory.description.description[key];
                    let result: any = null;
                    const keyIsFound = sourcesConf.some((sourceConf) => {
                        if (!sourceConf.conf) {
                            return false;
                        }
                        const keysToSearch = (descriptor.from && descriptor.from[sourceConf.loader]) ? descriptor.from[sourceConf.loader] : [descriptor.name];
                        return keysToSearch.some(keyToSearch => {
                            if (sourceConf.conf.hasOwnProperty(keyToSearch)) {
                                result = sourceConf.conf[keyToSearch];
                                if (result !== null && typeof result !== "string") {
                                    result = JSON.stringify(result);
                                }
                                return true;
                            } else {
                                return false;
                            }
                        })
                    });
                    if (!keyIsFound && descriptor.isMandatory) {
                        missingConf.push(descriptor.name);
                    }
                    let promiseToWait: Promise<any>;
                    if (!keyIsFound) {
                        promiseToWait = Promise.resolve(descriptor.default);
                    } else {
                        switch (descriptor.type) {
                            case 'boolean':
                                promiseToWait = ConfigurationFactory.formatBoolean(result, descriptor as any);
                                break;
                            case 'boolean[]':
                                promiseToWait = ConfigurationFactory.formatBooleanArray(result, descriptor as any);
                                break;
                            case 'json':
                                promiseToWait = ConfigurationFactory.formatJson(result, descriptor as any);
                                break;
                            case 'number':
                                promiseToWait = ConfigurationFactory.formatNumber(result, descriptor as any);
                                break;
                            case 'number[]':
                                promiseToWait = ConfigurationFactory.formatNumberArray(result, descriptor as any);
                                break;
                            case 'string':
                                promiseToWait = ConfigurationFactory.formatString(result, descriptor as any);
                                break;
                            case 'string[]':
                                promiseToWait = ConfigurationFactory.formatStringArray(result, descriptor as any);
                                break;
                        }
                    }
                    promisesToWait.push(promiseToWait.then(value => {
                        finalConf[descriptor.name as string] = value;
                    }));
                }
                let someErrorFromPromises: any = null;
                return Promise.all(promisesToWait).catch((e) => {
                    someErrorFromPromises = e;
                }).then(() => {
                    if (missingConf.length > 0) {
                        throw new Error('Some fields are missing from conf : ' + missingConf.join(', '));
                    }
                    if (someErrorFromPromises) {
                        throw someErrorFromPromises;
                    }
                    return finalConf;
                }).then(finalConf => {
                    // Check if save action was asked
                    const saveNames = factory.description.savesParams.longNames.concat(factory.description.savesParams.shortNames);
                    const saveActionTrigger = saveNames.some(saveParam => {
                        return sourcesConf.some(sourceConf => {
                            if (!sourceConf.conf) {
                                return false;
                            }
                            if (sourceConf.conf[saveParam]) {
                                // Current save param found into this source
                                return true;
                            }
                        });
                    });
                    if (saveActionTrigger) {
                        // Save conf
                        const saver = factory.description.saveConf || new ConfSaver();
                        return saver.save(factory, finalConf).then(() => finalConf);
                    } else {
                        return finalConf;
                    }
                })
            });
        });
        return factory.instance;
    }

    /**
     * Save to homedir the configuration
     * @param factory Factory of configuration
     */
    public static saveConf(factory: IConfigurationFactory<any>): Promise<void> {
        if (factory.instance === null) {
            return Promise.reject(new Error('Please init configuration before save it'));
        }

        const pathToFile = path.resolve(factory.description.homeDir || os.homedir(), factory.description.confFileName);
        return factory.instance.then((conf) => {
            return fs.writeJSON(pathToFile, conf);
        });
    }

    private static formatBoolean(value: string, descriptor: IConfigurationDescriptor<any, boolean>): Promise<boolean> {
        const temp = ('' + value).toLowerCase();
        if (temp === 'true') {
            return ConfigurationFactory.executeOnValueIfNeeded(descriptor, true);
        } else if (temp === 'false') {
            return ConfigurationFactory.executeOnValueIfNeeded(descriptor, false);
        } else if (temp === 'null') {
            if (descriptor.isNullable) {
                return ConfigurationFactory.executeOnValueIfNeeded(descriptor, null);
            } else {
                return ConfigurationFactory.executeOnBadValue(descriptor, value);
            }
        } else {
            return ConfigurationFactory.executeOnBadValue(descriptor, value);
        }
    }

    private static formatBooleanArray(value: string, descriptor: IConfigurationDescriptor<any, boolean[]>): Promise<boolean[]> {
        try {
            const waitingPromises: Promise<boolean>[] = [];
            if (value === null) {
                if (descriptor.isNullable) {
                    waitingPromises.push(ConfigurationFactory.executeOnValueIfNeeded(descriptor, null));
                } else {
                    waitingPromises.push(ConfigurationFactory.executeOnBadValue(descriptor, null));
                }
            } else {
                const parsedJson: boolean[] = JSON.parse(value);
                parsedJson.forEach((element, index) => {
                    if (element === true) {
                        waitingPromises.push(ConfigurationFactory.executeOnValueIfNeeded(descriptor, true, index));
                    } else if (element === false) {
                        waitingPromises.push(ConfigurationFactory.executeOnValueIfNeeded(descriptor, false, index));
                    } else if (element === null) {
                        if (descriptor.isNullable) {
                            waitingPromises.push(ConfigurationFactory.executeOnValueIfNeeded(descriptor, null, index));
                        } else {
                            waitingPromises.push(ConfigurationFactory.executeOnBadValue(descriptor, element, index));
                        }
                    } else {
                        waitingPromises.push(ConfigurationFactory.executeOnBadValue(descriptor, element, index));
                    }
                });
            }
            return Promise.all(waitingPromises);
        } catch (e) {
            return ConfigurationFactory.executeOnBadValue(descriptor, value);
        }
    }

    private static formatNumber(value: string, descriptor: IConfigurationDescriptor<any, number>): Promise<number> {
        if (value === null) {
            if (descriptor.isNullable) {
                return ConfigurationFactory.executeOnValueIfNeeded(descriptor, null);
            } else {
                return ConfigurationFactory.executeOnBadValue(descriptor, null);
            }
        }
        const temp = Number(value);
        if (isNaN(temp)) {
            return ConfigurationFactory.executeOnBadValue(descriptor, value);
        }
        return ConfigurationFactory.executeOnValueIfNeeded(descriptor, temp);
    }

    private static formatNumberArray(value: string, descriptor: IConfigurationDescriptor<any, number[]>): Promise<number[]> {
        try {
            const waitingPromises: Promise<number>[] = [];
            if (value === null) {
                if (descriptor.isNullable) {
                    waitingPromises.push(ConfigurationFactory.executeOnValueIfNeeded(descriptor, null));
                } else {
                    waitingPromises.push(ConfigurationFactory.executeOnBadValue(descriptor, null));
                }
            } else {
                const parsedJson: number[] = JSON.parse(value);
                parsedJson.forEach((element, index) => {
                    if (element === null) {
                        if (descriptor.isNullable) {
                            waitingPromises.push(ConfigurationFactory.executeOnValueIfNeeded(descriptor, null, index));
                        } else {
                            waitingPromises.push(ConfigurationFactory.executeOnBadValue(descriptor, element, index));
                        }
                    } else {
                        const temp = Number(element);
                        if (isNaN(temp)) {
                            waitingPromises.push(ConfigurationFactory.executeOnBadValue(descriptor, element, index));
                        }
                        waitingPromises.push(ConfigurationFactory.executeOnValueIfNeeded(descriptor, temp, index));
                    }
                });
            }
            return Promise.all(waitingPromises);
        } catch (e) {
            return ConfigurationFactory.executeOnBadValue(descriptor, value);
        }
    }

    private static formatString(value: string, descriptor: IConfigurationDescriptor<any, string>): Promise<string> {
        if (value === null) {
            if (descriptor.isNullable) {
                return ConfigurationFactory.executeOnValueIfNeeded(descriptor, null);
            } else {
                return ConfigurationFactory.executeOnBadValue(descriptor, null);
            }
        }
        return ConfigurationFactory.executeOnValueIfNeeded(descriptor, '' + value);
    }

    private static formatStringArray(value: string, descriptor: IConfigurationDescriptor<any, string[]>): Promise<string[]> {
        try {
            const waitingPromises: Promise<string>[] = [];
            if (value === null) {
                if (descriptor.isNullable) {
                    waitingPromises.push(ConfigurationFactory.executeOnValueIfNeeded(descriptor, null));
                } else {
                    waitingPromises.push(ConfigurationFactory.executeOnBadValue(descriptor, null));
                }
            } else {
                const parsedJson: string[] = JSON.parse(value);
                parsedJson.forEach((element, index) => {
                    if (element === null) {
                        if (descriptor.isNullable) {
                            waitingPromises.push(ConfigurationFactory.executeOnValueIfNeeded(descriptor, null, index));
                        } else {
                            waitingPromises.push(ConfigurationFactory.executeOnBadValue(descriptor, element, index));
                        }
                    } else {
                        waitingPromises.push(ConfigurationFactory.executeOnValueIfNeeded(descriptor, element, index));
                    }
                });
            }
            return Promise.all(waitingPromises);
        } catch (e) {
            return ConfigurationFactory.executeOnBadValue(descriptor, value);
        }
    }

    private static formatJson(value: string, descriptor: IConfigurationDescriptor<any, any>): Promise<any> {
        try {
            const parsedJson: any = JSON.parse(value);
            return ConfigurationFactory.executeOnValueIfNeeded(descriptor, parsedJson);
        } catch (e) {
            return ConfigurationFactory.executeOnBadValue(descriptor, value);
        }
    }

    private static getOrPromise<T>(element: Promise<T> | T): Promise<T> {
        if ((element as any).then) {
            return element as any;
        } else {
            return Promise.resolve(element);
        }
    }

    private static executeOnValueIfNeeded<U, V>(descriptor: IConfigurationDescriptor<any, U>, value: V, index?: number): Promise<V> {
        if (descriptor.onValue) {
            return ConfigurationFactory.getOrPromise(descriptor.onValue(value, index));
        } else {
            return Promise.resolve(value);
        }
    }

    private static executeOnBadValue<U, V>(descriptor: IConfigurationDescriptor<any, U>, badValue: any, index?: number): Promise<any> {
        if (descriptor.onBadValue) {
            return ConfigurationFactory.getOrPromise(descriptor.onBadValue(badValue, index));
        } else {
            if (index !== undefined) {
                return Promise.reject('Bad value for key ' + descriptor.name + ', index = ' + index);
            } else {
                return Promise.reject('Bad value for key ' + descriptor.name);
            }
        }
    }

    public static formatHelp(factory: IConfigurationFactory<any>): string {
        let result: string = "Configuration : ";
        result += os.EOL + "- Application parameters :"
        for (const key in factory.description.description) {
            const keyName = factory.description.description[key].name;
            result += os .EOL + "  --" + keyName;
            if (keyName.length > (ConfigurationFactory.HELP_COLUMN_NAME - 4)) {
                result += os.EOL + ConfigurationFactory.generateEmpty(ConfigurationFactory.HELP_COLUMN_TEXT);
            } else {
                result += ConfigurationFactory.generateEmpty(ConfigurationFactory.HELP_COLUMN_NAME - 4 - keyName.length);
            }
            result += ConfigurationFactory.splitText(factory.description.description[key].description || "");
        }
        if (factory.description.savesParams.longNames.length > 0 || factory.description.savesParams.shortNames.length > 0) {
            result += os.EOL
            result += os.EOL + "- To save parameters you can use :";
            result += os.EOL;
            result += "  " + [].concat(factory.description.savesParams.longNames.map(e => "--" + e))
                        .concat(factory.description.savesParams.shortNames.map(e => "-" + e))
                        .join(", ");
        }
        if (factory.description.helpsParams.longNames.length > 0 || factory.description.helpsParams.shortNames.length > 0) {
            result += os.EOL
            result += os.EOL + "- To show help you can use :";
            result += os.EOL;
            result += "  " + [].concat(factory.description.helpsParams.longNames.map(e => "--" + e))
                        .concat(factory.description.helpsParams.shortNames.map(e => "-" + e))
                        .join(", ");
        }
        return result;
    }

    private static generateEmpty(nb: number): string {
        return new Array(nb + 1).join(" ");
    }

    private static splitText(text: string): string {
        const parts = text.split(" ");
        let result = "";
        let currentLine = 0;
        const tabulations = ConfigurationFactory.generateEmpty(ConfigurationFactory.HELP_COLUMN_NAME);
        parts.forEach(part => {
            const size = part.length;
            if (size > ConfigurationFactory.HELP_COLUMN_TEXT) {
                if (currentLine > 0) {
                    result += os.EOL + tabulations;
                }
                do {
                    let subPart = part.substring(0, ConfigurationFactory.HELP_COLUMN_TEXT - 1) + '-';
                    part = part.substring(ConfigurationFactory.HELP_COLUMN_TEXT - 1);
                    result += subPart + os.EOL + tabulations;
                } while (part.length > ConfigurationFactory.HELP_COLUMN_TEXT);
                result += part;
                currentLine = part.length;
                return;
            }
            if (currentLine > 0 && ((size + currentLine + 1) > ConfigurationFactory.HELP_COLUMN_TEXT)) {
                result += os.EOL + tabulations;
                currentLine = 0;
            }
            if (currentLine > 0) {
                result += " ";
                currentLine += 1;
            }
            result += part;
            currentLine += size;
        });
        return result;
    }
}
