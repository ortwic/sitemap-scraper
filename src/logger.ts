import fs from 'fs'

const stream = fs.createWriteStream('result.log', { autoClose: true });

export const logger = (chunck: any) => {
    console.log(chunck);
    return stream.write(chunck + '\n');
};
