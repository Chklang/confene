import { expect } from 'chai';
import 'mocha';
import * as os from 'os';
import * as uuid from 'uuid';
import * as fs from 'fs-extra';
import * as path from 'path';
import { IConfigurationParameters, ConfigurationFactory, ConfLoader } from '../../src';


interface IConfig {
    key: string;
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

describe('When i want load config from configuration file', () => {
    let pathToConfFile: string = null;
    beforeEach(() => {
        return generateNewPath(os.homedir(), '.json').then((newPath) => {
            pathToConfFile = newPath.path;
            ConfigFactory.description = {
                confFileName: newPath.name,
                loaders: [new ConfLoader()],
                description: {
                    key: {
                        name: 'key',
                        type: 'string',
                        isMandatory: false
                    }
                }
            }
        })
    });
    afterEach(() => {
        ConfigFactory.instance = null;
        return fs.pathExists(pathToConfFile).then((isExists) => {
            if (isExists) {
                return fs.remove(pathToConfFile);
            }
        });
    });
    it('Conf file not exists', () => {
        return ConfigurationFactory.get(ConfigFactory).then((config) => {
            expect(config.key).to.be.undefined;
        });
    });
    it('Conf file exists', () => {
        return fs.writeFile(pathToConfFile, JSON.stringify(<IConfig>{
            key: 'toto'
        })).then(() => {
            return ConfigurationFactory.get(ConfigFactory);
        }).then((config) => {
            expect(config.key).to.be.eq('toto');
        });
    });
    it('Conf file into another folder', () => {
        let completePathToFile: string;
        const clean = () => {
            return fs.remove(completePathToFile).then(() => {
                return fs.remove(ConfigFactory.description.homeDir);
            });
        };
        return generateNewPath(os.tmpdir()).then(newPath => {
            ConfigFactory.description.homeDir = newPath.path;
            ConfigFactory.description.confFileName = 'test.json';
            completePathToFile = path.resolve(newPath.path, 'test.json');
            return fs.mkdir(ConfigFactory.description.homeDir);
        }).then(() => {
            return fs.writeFile(completePathToFile, JSON.stringify(<IConfig>{
                key: 'toto'
            }));
        }).then(() => {
            return ConfigurationFactory.get(ConfigFactory);
        }).then((config) => {
            expect(config.key).to.be.eq('toto');
        }).finally(() => {
            return clean();
        });
    });
});