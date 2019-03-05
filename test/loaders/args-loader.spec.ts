import { expect } from 'chai';
import 'mocha';
import { IConfigurationParameters, ConfigurationFactory, ArgsLoader } from '../../src';


interface IConfig {
    key: string;
}
class ConfigFactory {
    public static instance: Promise<IConfig>;
    public static description: IConfigurationParameters<IConfig> = null;
}

describe('When i want load config from arguments', () => {
    let oldArgs = null;
    let currentArgs: string[];
    beforeEach(() => {
        oldArgs = process.argv;
        currentArgs = [oldArgs[0]];
        process.argv = currentArgs;
        ConfigFactory.description = {
            loaders: [new ArgsLoader()],
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
        process.argv = oldArgs;
    });
    it('Argument not exists', () => {
        return ConfigurationFactory.get(ConfigFactory).then((config) => {
            expect(config.key).to.be.undefined;
        });
    });
    it('Argument exists', () => {
        currentArgs.push('--key', 'toto');
        return ConfigurationFactory.get(ConfigFactory).then((config) => {
            expect(config.key).to.be.eq('toto');
        });
    });
});