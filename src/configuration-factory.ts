import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as minimist from 'minimist';
import { IConfigurationFactory } from './i-configuration-factory';
import { IConfigurationDescriptor } from './i-configuration-descriptor';
import {ArgsLoader} from './loaders/args-loader';
import {ConfLoader} from './loaders/conf-loader';
import {EnvLoader} from './loaders/env-loader';

export class ConfigurationFactory<T> {
    /**
     * Calculate or give a pre-calculated configuration
     * @param factory Factory of configuration
     */
    public static get<T>(factory: IConfigurationFactory<T>): Promise<T> {
        if (factory.instance) {
            return factory.instance;
        }
        factory.instance = Promise.resolve().then(() => {
            const loaders = factory.description.loaders || [new ArgsLoader(), new EnvLoader(), new ConfLoader()];
            return Promise.all(loaders.map(loader => {
                return loader.load(factory);
            })).then(sourcesConf => {
                const missingConf: string[] = [];
                const finalConf: T = {} as T;
                const args = minimist.default(process.argv);
                const promisesToWait: Promise<void>[] = [];
                for (let key in factory.description.description) {
                    const descriptor = factory.description.description[key];
                    const keyFromConfFile = descriptor.fromConf || descriptor.name;
                    const keyFromEnv = descriptor.fromEnv || descriptor.name;
                    const keyFromParam = descriptor.fromParam || descriptor.name;
                    let result: any = null;
                    const keyIsFound = sourcesConf.some((sourceConf) => {
                        if (sourceConf[keyFromParam]) {
                            result = args[keyFromParam];
                            return true;
                        }
                        return false;
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
        } else if (temp === 'undefined') {
            if (descriptor.isUndefinedable) {
                return ConfigurationFactory.executeOnValueIfNeeded(descriptor, undefined);
            } else {
                return ConfigurationFactory.executeOnBadValue(descriptor, value);
            }
        } else {
            return ConfigurationFactory.executeOnBadValue(descriptor, value);
        }
    }

    private static formatBooleanArray(value: string, descriptor: IConfigurationDescriptor<any, boolean[]>): Promise<boolean[]> {
        try {
            const parsedJson: boolean[] = JSON.parse(value);
            const waitingPromises: Promise<boolean>[] = [];
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
                } else if (element === undefined) {
                    if (descriptor.isUndefinedable) {
                        waitingPromises.push(ConfigurationFactory.executeOnValueIfNeeded(descriptor, undefined, index));
                    } else {
                        waitingPromises.push(ConfigurationFactory.executeOnBadValue(descriptor, element, index));
                    }
                } else {
                    waitingPromises.push(ConfigurationFactory.executeOnBadValue(descriptor, element, index));
                }
            });
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
        if (value === undefined) {
            if (descriptor.isUndefinedable) {
                return ConfigurationFactory.executeOnValueIfNeeded(descriptor, undefined);
            } else {
                return ConfigurationFactory.executeOnBadValue(descriptor, undefined);
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
            const parsedJson: number[] = JSON.parse(value);
            const waitingPromises: Promise<number>[] = [];
            parsedJson.forEach((element, index) => {
                if (element === null) {
                    if (descriptor.isNullable) {
                        waitingPromises.push(ConfigurationFactory.executeOnValueIfNeeded(descriptor, null, index));
                    } else {
                        waitingPromises.push(ConfigurationFactory.executeOnBadValue(descriptor, element, index));
                    }
                } else if (element === undefined) {
                    if (descriptor.isUndefinedable) {
                        waitingPromises.push(ConfigurationFactory.executeOnValueIfNeeded(descriptor, undefined, index));
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
        if (value === undefined) {
            if (descriptor.isUndefinedable) {
                return ConfigurationFactory.executeOnValueIfNeeded(descriptor, undefined);
            } else {
                return ConfigurationFactory.executeOnBadValue(descriptor, undefined);
            }
        }
        return ConfigurationFactory.executeOnValueIfNeeded(descriptor, '' + value);
    }

    private static formatStringArray(value: string, descriptor: IConfigurationDescriptor<any, string[]>): Promise<string[]> {
        try {
            const parsedJson: string[] = JSON.parse(value);
            const waitingPromises: Promise<string>[] = [];
            parsedJson.forEach((element, index) => {
                if (element === null) {
                    if (descriptor.isNullable) {
                        waitingPromises.push(ConfigurationFactory.executeOnValueIfNeeded(descriptor, null, index));
                    } else {
                        waitingPromises.push(ConfigurationFactory.executeOnBadValue(descriptor, element, index));
                    }
                } else if (element === undefined) {
                    if (descriptor.isUndefinedable) {
                        waitingPromises.push(ConfigurationFactory.executeOnValueIfNeeded(descriptor, undefined, index));
                    } else {
                        waitingPromises.push(ConfigurationFactory.executeOnBadValue(descriptor, element, index));
                    }
                } else {
                    waitingPromises.push(ConfigurationFactory.executeOnValueIfNeeded(descriptor, element, index));
                }
            });
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

    private static loadConfFile(confFileName: string, homeDir?: string): Promise<any> {
        const pathToFile = path.resolve(homeDir || os.homedir(), confFileName);
        return fs.pathExists(pathToFile).then((isExists) => {
            if (!isExists) {
                return null;
            } else {
                return fs.readJSON(pathToFile);
            }
        })
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
        return ConfigurationFactory.getOrPromise(descriptor.onBadValue(badValue, index));
    }
}
