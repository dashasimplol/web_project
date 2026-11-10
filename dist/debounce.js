export function debounce(fn, delayMs) {
    let timerId;
    return (...args) => {
        clearTimeout(timerId);
        timerId = setTimeout(() => fn(...args), delayMs);
    };
}
