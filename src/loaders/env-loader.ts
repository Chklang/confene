import * as minimist from 'minimist';

import { ILoader } from "./i-loader";
import { IConfigurationFactory } from "..";

export class EnvLoader implements ILoader {
    public static loaderName: string = 'env';
    public loaderName: string
    public constructor(
        loaderName?: string
    ) {
        this.loaderName = loaderName || EnvLoader.loaderName;
    }
    public load(factory: IConfigurationFactory<any>): Promise<{[key: string]: any}> {
        return Promise.resolve(process.env);
    }
}