import { IConfigurationFactory } from "..";

export interface ILoader {
    name: string;
    load(factory: IConfigurationFactory<any>): Promise<{[key: string]: any}>;
}