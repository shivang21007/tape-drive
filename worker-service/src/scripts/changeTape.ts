import { TapeManager } from '../services/tapeManager';

const tapeManager = new TapeManager();


const getArgs = () => {
    const args = process.argv.slice(2)
    if (args.length !== 1) {
        console.log("Usage: node changeTape.ts <tapeNumber>");
        process.exit(1);
    }
    return args[0];
}

const switchTape = async (requiredTape: string): Promise<string | null> => {
    try {
        await tapeManager.unmountTape();
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for unmount
        await tapeManager.unloadTape();
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for unload
        await tapeManager.loadTape(requiredTape);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for load
        await tapeManager.mountTape();
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for mount
        const newTape = await tapeManager.getCurrentTape();
        return newTape;
    } catch (error) {
        console.error('Error switching tape:', error);
        return null;
    }
}

const main = async () => {
    const allowedTapes: string[] = ["4", "6", "7", "9", "10", "11", "12", "13", "14", "15"];

    const tapeNumber: string = getArgs();

    if (!allowedTapes.includes(tapeNumber)) {
        console.log(`Invalid tape number: ${tapeNumber}, allowed tapes: ${allowedTapes}`);
        process.exit(1);
    }

    console.log("Starting tape switch ....");
    const isMounted = await tapeManager.isTapeMounted();
    if (!isMounted) {
        console.log("Tape is not mounted");
        await tapeManager.mountTape();
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for mount
        return;
    }
    const currentTape = await tapeManager.getCurrentTape();
    if (!currentTape) {
        console.log("Unable to get current tape");
        return;
    }
    console.log(`Current tape: ${currentTape}`);

    //if the current tape is the correct tape, do nothing
    if (currentTape === tapeNumber) {
        console.log(`Correct tape ${tapeNumber} is already mounted`);

    } else {
        console.log(`Need to switch tapes. Current: ${currentTape}, Required: ${tapeNumber}`);
        const newTape = await switchTape(tapeNumber);
        if (newTape) {
            console.log(`New tape: ${newTape}`);
        } else {
            console.log("Unable to switch tape");
        }
    }
    console.log("Tape switch completed ....");
    return;
}

main();