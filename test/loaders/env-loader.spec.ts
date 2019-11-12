import { expect } from 'chai';
import 'mocha';
import { IConfigurationParameters, ConfigurationFactory, EnvLoader } from '../../src';

interface IConfig {
    key: string;
}
class ConfigFactory {
    public static instance: Promise<IConfig>;
    public static description: IConfigurationParameters<IConfig> = null;
}

describe('When i want load config from environment variable', () => {
    let oldEnv = null;
    let currentEnv: Partial<IConfig>;
    beforeEach(() => {
        oldEnv = process.env;
        currentEnv = {};
        process.env = currentEnv;
        ConfigFactory.description = {
            confFileName: ".test.env",
            loaders: [new EnvLoader()],
            description: {
                key: {
                    name: 'key',
                    type: 'string',
                    isMandatory: false
                }
            }
        }
    });
    afterEach(() => {
        ConfigFactory.instance = null;
        process.env = oldEnv;
    });
    it('Environment variable not exists', () => {
        return ConfigurationFactory.get(ConfigFactory).then((config) => {
            expect(config.key).to.be.undefined;
        });
    });
    it('Environment variable exists', () => {
        currentEnv.key = 'toto';
        return ConfigurationFactory.get(ConfigFactory).then((config) => {
            expect(config.key).to.be.eq('toto');
        });
    });
});