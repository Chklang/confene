import { expect, assert } from 'chai';
import 'mocha';
import * as os from 'os';
import * as uuid from 'uuid';
import * as fs from 'fs-extra';
import * as path from 'path';
import { IConfigurationParameters, ConfigurationFactory } from '../src';

interface IConfig {
    key1: string;
    key2: string;
    key3: string;
    key4: string;
}
class ConfigFactory {
    public static instance: Promise<IConfig>;
    public static description: IConfigurationParameters<IConfig> = null;
}

interface INewPath {
    path: string;
    base: string;
    name: string;
}
function generateNewPath(base: string, suffixe?: string): Promise<INewPath> {
    return new Promise<INewPath>((resolve, reject) => {
        const retryGenerateFilename = () => {
            const fileName = uuid.v4() + (suffixe?suffixe:'');
            const pathToConfFile = path.resolve(base, fileName);
            fs.pathExists(pathToConfFile).then((isExists) => {
                if (isExists) {
                    //Generate another path
                    retryGenerateFilename();
                } else {
                    //Give result
                    resolve({
                        base: base,
                        name: fileName,
                        path: pathToConfFile
                    });
                }
            }, reject);
        }
        retryGenerateFilename();
    });
}

describe('When i want load config by default', () => {
    let oldArgs = null;
    let currentArgs: string[];
    let oldEnv = null;
    let currentEnv: Partial<IConfig>;
    let pathToConfFile: string = null;

    beforeEach(() => {
        //Env mock
        oldEnv = process.env;
        currentEnv = {};
        process.env = currentEnv;
        //Args mock
        oldArgs = process.argv;
        currentArgs = [oldArgs[0]];
        process.argv = currentArgs;
        //File 
        return generateNewPath(os.homedir(), '.json').then((newPath) => {
            pathToConfFile = newPath.path;
            //Create factory
            ConfigFactory.description = {
                confFileName: newPath.name,
                description: {
                    key1: {
                        name: 'key1',
                        type: 'string',
                        isMandatory: false
                    },
                    key2: {
                        name: 'key2',
                        type: 'string',
                        isMandatory: false
                    },
                    key3: {
                        name: 'key3',
                        type: 'string',
                        isMandatory: false
                    },
                    key4: {
                        name: 'key4',
                        type: 'string',
                        isMandatory: false
                    }
                }
            }
        });
    });
    afterEach(() => {
        ConfigFactory.instance = null;
        process.env = oldEnv;
        ConfigFactory.instance = null;
        process.argv = oldArgs;
        return fs.pathExists(pathToConfFile).then((isExists) => {
            if (isExists) {
                return fs.remove(pathToConfFile);
            }
        });
    });
    it('I read arguments in first, environment, and conf at last', () => {
        currentArgs.push('--key1', 'valueA1');
        currentEnv.key1 = 'valueB1';
        currentEnv.key2 = 'valueB2';
        
        return fs.writeFile(pathToConfFile, JSON.stringify(<Partial<IConfig>>{
            key1: 'valueC1',
            key2: 'valueC2',
            key3: 'valueC3'
        })).then(() => {
            return ConfigurationFactory.get(ConfigFactory);
        }).then((config) => {
            expect(config.key1).to.be.eq('valueA1', 'Key from args');
            expect(config.key2).to.be.eq('valueB2', 'Key from env');
            expect(config.key3).to.be.eq('valueC3', 'Key from conf');
            expect(config.key4).to.be.undefined;
        });
    });
    it('I can specify some mandatory files', () => {
        ConfigFactory.description.description.key3.isMandatory = true;
        ConfigFactory.description.description.key4.isMandatory = true;
        return ConfigurationFactory.get(ConfigFactory).then(() => {
            assert.fail('Exception isn\'t thrown');
        }, (e: Error) => {
            expect(e.message).to.be.eq('Some fields are missing from conf : key3, key4');
        });
    });
    it('I can specify some default values', () => {
        ConfigFactory.description.description.key3.default = 'default1';
        ConfigFactory.description.description.key4.default = 'default2';
        return ConfigurationFactory.get(ConfigFactory).then((conf) => {
            expect(conf.key3).to.be.eq('default1');
            expect(conf.key4).to.be.eq('default2');
        });
    });
    it('I can forbid null value', () => {
        ConfigFactory.description.description.key1.isNullable = true;
        ConfigFactory.description.description.key2.isNullable = true;
        ConfigFactory.description.description.key3.isNullable = false;
        ConfigFactory.description.description.key4.isNullable = false;
        ConfigFactory.description.description.key1.default = 'default1';
        ConfigFactory.description.description.key2.default = 'default2';
        ConfigFactory.description.description.key3.default = 'default3';
        ConfigFactory.description.description.key4.default = 'default4';
        ConfigFactory.description.description.key3.onBadValue = () => {
            return 'default3b';
        }
        ConfigFactory.description.description.key4.onBadValue = () => {
            return 'default4b';
        }
        
        return fs.writeFile(pathToConfFile, JSON.stringify(<Partial<IConfig>>{
            key1: null,
            key2: null,
            key3: null,
            key4: null
        })).then(() => {
            return ConfigurationFactory.get(ConfigFactory);
        }).then((conf) => {
            expect(conf.key1).to.be.eq(null);
            expect(conf.key2).to.be.eq(null);
            expect(conf.key3).to.be.eq('default3b');
            expect(conf.key4).to.be.eq('default4b');
        });
    });
});