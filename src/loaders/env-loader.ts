import * as minimist from 'minimist';

import { ILoader } from "./i-loader";
import { IConfigurationFactory } from "..";

export class EnvLoader implements ILoader {
    public name: string
    public constructor(
        name?: string
    ) {
        this.name = name || 'env'
    }
    public load(factory: IConfigurationFactory<any>): Promise<{[key: string]: any}> {
        return Promise.resolve(process.env);
    }
}