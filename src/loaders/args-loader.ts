import * as minimist from 'minimist';

import { ILoader } from "./i-loader";
import { IConfigurationFactory } from "..";

export class ArgsLoader implements ILoader {
    public load(factory: IConfigurationFactory<any>): Promise<{[key: string]: any}> {
        return Promise.resolve(minimist.default(process.argv));
    }
}