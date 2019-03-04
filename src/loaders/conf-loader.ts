import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

import { ILoader } from "./i-loader";
import { IConfigurationFactory } from "..";

export class ConfLoader implements ILoader {
    public load(factory: IConfigurationFactory<any>): Promise<{[key: string]: any}> {
        const pathToFile = path.resolve(factory.description.homeDir || os.homedir(), factory.description.confFileName);
        return fs.pathExists(pathToFile).then((isExists) => {
            if (!isExists) {
                return null;
            } else {
                return fs.readJSON(pathToFile);
            }
        });
    }
}