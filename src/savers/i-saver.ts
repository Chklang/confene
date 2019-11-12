import { IConfigurationFactory } from "..";

export interface ISaver {
    saverName: string;
    save<T>(factory: IConfigurationFactory<T>, conf: T): Promise<void>;
}