import { IConfigurationFactory } from "..";

export interface ILoader {
    load(factory: IConfigurationFactory<any>): Promise<{[key: string]: any}>;
}