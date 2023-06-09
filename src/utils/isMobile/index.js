export default function isMobile() {
    return window.navigator.userAgent === "capacitor" || Math.min(window.screen.width, window.screen.height) < 768 || navigator.userAgent.indexOf("Mobi") > -1
}