import { TapeManager } from '../services/tapeManager';
import { generateFilesDetailsCSV } from './generateFilesDetailsCSV';
import { generateTapeInfoCSV } from './generateTapeInfoCSV';

const tapeManager = new TapeManager();

const basePath = '/home/octro/tapedata1/';

const switchTape = async (requiredTape: string): Promise<string> => {
    console.log(`🔄 Starting tape switch to ${requiredTape} ....`);
    const isMounted = await tapeManager.isTapeMounted();
    if (!isMounted) {
        console.log("Tape is not mounted");
        await tapeManager.mountTape();
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for mount
    }
    const currentTape = await tapeManager.getCurrentTape();
    if (!currentTape) {
        console.error(`Unable to get current tape. \nExiting Script ...`);
        process.exit(1);
    }
    console.log(`Current tape: ${currentTape}`);

    let newTape: string = '';

    //if the current tape is the correct tape, do nothing
    if (currentTape === requiredTape) {
        console.log(`Correct tape ${requiredTape} is already mounted`);
        newTape = currentTape;
    } else {
        console.log(`Need to switch tapes. Current: ${currentTape}, Required: ${requiredTape}`);
        try {
            await tapeManager.unmountTape();
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for unmount
            await tapeManager.unloadTape();
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for unload
            await tapeManager.loadTape(requiredTape);
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for load
            await tapeManager.mountTape();
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for mount
            newTape = await tapeManager.getCurrentTape() || '';
            if (!newTape) {
                console.error('Error switching tape: Unable to get new tape');
                process.exit(1);
            }
        } catch (error) {
            console.error('Error switching tape:', error);
            process.exit(1);
        }
    }
    console.log(`✅ Tape switch completed to ${newTape} ....`)
    return newTape;
}

let startGettingFilesDetails: boolean = false;

const main = async () => {
    const allowedTapes: string[] = ["000006", "000004", "000007","000009","000010","000011","000001","000008","000003","000012","000013","000014","000015","000024"];

    for (const tape of allowedTapes) {
        const newTape = await switchTape(tape);
        if(newTape != tape) {
            console.error(`Error switching to tape: ${tape}`);
            process.exit(1);
        }
        console.log(`Generating tape info for ${newTape} ...`);
        await generateTapeInfoCSV(newTape, basePath);

        if(tape === '000001') {
            startGettingFilesDetails = true;
        }

        if (startGettingFilesDetails) {
            const csvPath = `upload_details_tape${newTape}.csv`;
            await generateFilesDetailsCSV(newTape, basePath, csvPath);
        }
    }
    console.log("✅ All tapes processed ....")
    process.exit(0);
}

main();