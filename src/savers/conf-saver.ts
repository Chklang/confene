import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { ISaver } from "./i-saver";
import { IConfigurationFactory } from "..";

export class ConfSaver implements ISaver {
    public static saverName: string = 'conf';
    public saverName : string
    public constructor(
        saverName?: string
    ) {
        this.saverName = saverName || ConfSaver.saverName;
    }
    public save(factory: IConfigurationFactory<any>, conf: any): Promise<void> {
        const pathToFile = path.resolve(factory.description.homeDir || os.homedir(), factory.description.confFileName);
        const parent = path.dirname(pathToFile);
        const confToSerialize: any = {};
        for (const key in factory.description.description) {
            if (!conf[key]) {
                // Not exists, ignore
                return;
            }
            const keyDescription = factory.description.description[key];
            let keyName = keyDescription.name;
            if (keyDescription.from && keyDescription.from[this.saverName] && keyDescription.from[this.saverName].length > 0) {
                keyName = keyDescription.from[this.saverName][0];
            }
            confToSerialize[keyName] = conf[key];
        }
        return fs.pathExists(parent).then(isParentExists => {
            if (!isParentExists) {
                return fs.mkdirp(parent);
            }
        }).then(() => {
            return fs.writeFile(pathToFile, JSON.stringify(confToSerialize));
        });
    }
}