import { IConfigurationFactory } from "..";

export interface ILoader {
    loaderName: string;
    load(factory: IConfigurationFactory<any>): Promise<{[key: string]: any}>;
}