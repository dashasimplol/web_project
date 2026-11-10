function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export async function withRetry(task, attempts, delayMs) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await task();
        }
        catch (error) {
            lastError = error;
            if (attempt < attempts)
                await sleep(delayMs);
        }
    }
    throw lastError;
}
