import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Fragment, memo, useEffect, useRef, useState } from "react";
import { collapseDownIcon, upIcon, searchIcon } from "./icons";
import { TextField } from "./TextField";
import { Button } from "./Button";
import { useApp, useExcalidrawSetAppState } from "./App";
import { debounce } from "lodash";
import { isTextElement, newTextElement } from "../element";
import { measureText } from "../element/textElement";
import { addEventListener, getFontString } from "../utils";
import { KEYS } from "../keys";
import clsx from "clsx";
import { atom, useAtom } from "jotai";
import { jotaiScope } from "../jotai";
import { t } from "../i18n";
import { isElementCompletelyInViewport } from "../element/sizeHelpers";
import { randomInteger } from "../random";
import { CLASSES, EVENT } from "../constants";
import { useStable } from "../hooks/useStable";
import "./SearchMenu.scss";
import { round } from "../../math";
const searchQueryAtom = atom("");
export const searchItemInFocusAtom = atom(null);
const SEARCH_DEBOUNCE = 350;
export const SearchMenu = () => {
    const app = useApp();
    const setAppState = useExcalidrawSetAppState();
    const searchInputRef = useRef(null);
    const [inputValue, setInputValue] = useAtom(searchQueryAtom, jotaiScope);
    const searchQuery = inputValue.trim();
    const [isSearching, setIsSearching] = useState(false);
    const [searchMatches, setSearchMatches] = useState({
        nonce: null,
        items: [],
    });
    const searchedQueryRef = useRef(null);
    const lastSceneNonceRef = useRef(undefined);
    const [focusIndex, setFocusIndex] = useAtom(searchItemInFocusAtom, jotaiScope);
    const elementsMap = app.scene.getNonDeletedElementsMap();
    useEffect(() => {
        if (isSearching) {
            return;
        }
        if (searchQuery !== searchedQueryRef.current ||
            app.scene.getSceneNonce() !== lastSceneNonceRef.current) {
            searchedQueryRef.current = null;
            handleSearch(searchQuery, app, (matchItems, index) => {
                setSearchMatches({
                    nonce: randomInteger(),
                    items: matchItems,
                });
                searchedQueryRef.current = searchQuery;
                lastSceneNonceRef.current = app.scene.getSceneNonce();
                setAppState({
                    searchMatches: matchItems.map((searchMatch) => ({
                        id: searchMatch.textElement.id,
                        focus: false,
                        matchedLines: searchMatch.matchedLines,
                    })),
                });
            });
        }
    }, [
        isSearching,
        searchQuery,
        elementsMap,
        app,
        setAppState,
        setFocusIndex,
        lastSceneNonceRef,
    ]);
    const goToNextItem = () => {
        if (searchMatches.items.length > 0) {
            setFocusIndex((focusIndex) => {
                if (focusIndex === null) {
                    return 0;
                }
                return (focusIndex + 1) % searchMatches.items.length;
            });
        }
    };
    const goToPreviousItem = () => {
        if (searchMatches.items.length > 0) {
            setFocusIndex((focusIndex) => {
                if (focusIndex === null) {
                    return 0;
                }
                return focusIndex - 1 < 0
                    ? searchMatches.items.length - 1
                    : focusIndex - 1;
            });
        }
    };
    useEffect(() => {
        setAppState((state) => {
            return {
                searchMatches: state.searchMatches.map((match, index) => {
                    if (index === focusIndex) {
                        return { ...match, focus: true };
                    }
                    return { ...match, focus: false };
                }),
            };
        });
    }, [focusIndex, setAppState]);
    useEffect(() => {
        if (searchMatches.items.length > 0 && focusIndex !== null) {
            const match = searchMatches.items[focusIndex];
            if (match) {
                const zoomValue = app.state.zoom.value;
                const matchAsElement = newTextElement({
                    text: match.searchQuery,
                    x: match.textElement.x + (match.matchedLines[0]?.offsetX ?? 0),
                    y: match.textElement.y + (match.matchedLines[0]?.offsetY ?? 0),
                    width: match.matchedLines[0]?.width,
                    height: match.matchedLines[0]?.height,
                    fontSize: match.textElement.fontSize,
                    fontFamily: match.textElement.fontFamily,
                });
                const FONT_SIZE_LEGIBILITY_THRESHOLD = 14;
                const fontSize = match.textElement.fontSize;
                const isTextTiny = fontSize * zoomValue < FONT_SIZE_LEGIBILITY_THRESHOLD;
                if (!isElementCompletelyInViewport([matchAsElement], app.canvas.width / window.devicePixelRatio, app.canvas.height / window.devicePixelRatio, {
                    offsetLeft: app.state.offsetLeft,
                    offsetTop: app.state.offsetTop,
                    scrollX: app.state.scrollX,
                    scrollY: app.state.scrollY,
                    zoom: app.state.zoom,
                }, app.scene.getNonDeletedElementsMap(), app.getEditorUIOffsets()) ||
                    isTextTiny) {
                    let zoomOptions;
                    if (isTextTiny) {
                        if (fontSize >= FONT_SIZE_LEGIBILITY_THRESHOLD) {
                            zoomOptions = { fitToContent: true };
                        }
                        else {
                            zoomOptions = {
                                fitToViewport: true,
                                // calculate zoom level to make the fontSize ~equal to FONT_SIZE_THRESHOLD, rounded to nearest 10%
                                maxZoom: round(FONT_SIZE_LEGIBILITY_THRESHOLD / fontSize, 1),
                            };
                        }
                    }
                    else {
                        zoomOptions = { fitToContent: true };
                    }
                    app.scrollToContent(matchAsElement, {
                        animate: true,
                        duration: 300,
                        ...zoomOptions,
                        canvasOffsets: app.getEditorUIOffsets(),
                    });
                }
            }
        }
    }, [focusIndex, searchMatches, app]);
    useEffect(() => {
        return () => {
            setFocusIndex(null);
            searchedQueryRef.current = null;
            lastSceneNonceRef.current = undefined;
            setAppState({
                searchMatches: [],
            });
            setIsSearching(false);
        };
    }, [setAppState, setFocusIndex]);
    const stableState = useStable({
        goToNextItem,
        goToPreviousItem,
        searchMatches,
    });
    useEffect(() => {
        const eventHandler = (event) => {
            if (event.key === KEYS.ESCAPE &&
                !app.state.openDialog &&
                !app.state.openPopup) {
                event.preventDefault();
                event.stopPropagation();
                setAppState({
                    openSidebar: null,
                });
                return;
            }
            if (event[KEYS.CTRL_OR_CMD] && event.key === KEYS.F) {
                event.preventDefault();
                event.stopPropagation();
                if (!searchInputRef.current?.matches(":focus")) {
                    if (app.state.openDialog) {
                        setAppState({
                            openDialog: null,
                        });
                    }
                    searchInputRef.current?.focus();
                    searchInputRef.current?.select();
                }
                else {
                    setAppState({
                        openSidebar: null,
                    });
                }
            }
            if (event.target instanceof HTMLElement &&
                event.target.closest(".layer-ui__search")) {
                if (stableState.searchMatches.items.length) {
                    if (event.key === KEYS.ENTER) {
                        event.stopPropagation();
                        stableState.goToNextItem();
                    }
                    if (event.key === KEYS.ARROW_UP) {
                        event.stopPropagation();
                        stableState.goToPreviousItem();
                    }
                    else if (event.key === KEYS.ARROW_DOWN) {
                        event.stopPropagation();
                        stableState.goToNextItem();
                    }
                }
            }
        };
        // `capture` needed to prevent firing on initial open from App.tsx,
        // as well as to handle events before App ones
        return addEventListener(window, EVENT.KEYDOWN, eventHandler, {
            capture: true,
            passive: false,
        });
    }, [setAppState, stableState, app]);
    const matchCount = `${searchMatches.items.length} ${searchMatches.items.length === 1
        ? t("search.singleResult")
        : t("search.multipleResults")}`;
    return (_jsxs("div", { className: "layer-ui__search", children: [_jsx("div", { className: "layer-ui__search-header", children: _jsx(TextField, { className: CLASSES.SEARCH_MENU_INPUT_WRAPPER, value: inputValue, ref: searchInputRef, placeholder: t("search.placeholder"), icon: searchIcon, onChange: (value) => {
                        setInputValue(value);
                        setIsSearching(true);
                        const searchQuery = value.trim();
                        handleSearch(searchQuery, app, (matchItems, index) => {
                            setSearchMatches({
                                nonce: randomInteger(),
                                items: matchItems,
                            });
                            setFocusIndex(index);
                            searchedQueryRef.current = searchQuery;
                            lastSceneNonceRef.current = app.scene.getSceneNonce();
                            setAppState({
                                searchMatches: matchItems.map((searchMatch) => ({
                                    id: searchMatch.textElement.id,
                                    focus: false,
                                    matchedLines: searchMatch.matchedLines,
                                })),
                            });
                            setIsSearching(false);
                        });
                    }, selectOnRender: true }) }), _jsxs("div", { className: "layer-ui__search-count", children: [searchMatches.items.length > 0 && (_jsxs(_Fragment, { children: [focusIndex !== null && focusIndex > -1 ? (_jsxs("div", { children: [focusIndex + 1, " / ", matchCount] })) : (_jsx("div", { children: matchCount })), _jsxs("div", { className: "result-nav", children: [_jsx(Button, { onSelect: () => {
                                            goToNextItem();
                                        }, className: "result-nav-btn", children: collapseDownIcon }), _jsx(Button, { onSelect: () => {
                                            goToPreviousItem();
                                        }, className: "result-nav-btn", children: upIcon })] })] })), searchMatches.items.length === 0 &&
                        searchQuery &&
                        searchedQueryRef.current && (_jsx("div", { style: { margin: "1rem auto" }, children: t("search.noMatch") }))] }), _jsx(MatchList, { matches: searchMatches, onItemClick: setFocusIndex, focusIndex: focusIndex, searchQuery: searchQuery })] }));
};
const ListItem = (props) => {
    const preview = [
        props.preview.moreBefore ? "..." : "",
        props.preview.previewText.slice(0, props.preview.indexInSearchQuery),
        props.preview.previewText.slice(props.preview.indexInSearchQuery, props.preview.indexInSearchQuery + props.searchQuery.length),
        props.preview.previewText.slice(props.preview.indexInSearchQuery + props.searchQuery.length),
        props.preview.moreAfter ? "..." : "",
    ];
    return (_jsx("div", { tabIndex: -1, className: clsx("layer-ui__result-item", {
            active: props.highlighted,
        }), onClick: props.onClick, ref: (ref) => {
            if (props.highlighted) {
                ref?.scrollIntoView({ behavior: "auto", block: "nearest" });
            }
        }, children: _jsx("div", { className: "preview-text", children: preview.flatMap((text, idx) => (_jsx(Fragment, { children: idx === 2 ? _jsx("b", { children: text }) : text }, idx))) }) }));
};
const MatchListBase = (props) => {
    return (_jsx("div", { className: "layer-ui__search-result-container", children: props.matches.items.map((searchMatch, index) => (_jsx(ListItem, { searchQuery: props.searchQuery, preview: searchMatch.preview, highlighted: index === props.focusIndex, onClick: () => props.onItemClick(index) }, searchMatch.textElement.id + searchMatch.index))) }));
};
const areEqual = (prevProps, nextProps) => {
    return (prevProps.matches.nonce === nextProps.matches.nonce &&
        prevProps.focusIndex === nextProps.focusIndex);
};
const MatchList = memo(MatchListBase, areEqual);
const getMatchPreview = (text, index, searchQuery) => {
    const WORDS_BEFORE = 2;
    const WORDS_AFTER = 5;
    const substrBeforeQuery = text.slice(0, index);
    const wordsBeforeQuery = substrBeforeQuery.split(/\s+/);
    // text = "small", query = "mall", not complete before
    // text = "small", query = "smal", complete before
    const isQueryCompleteBefore = substrBeforeQuery.endsWith(" ");
    const startWordIndex = wordsBeforeQuery.length -
        WORDS_BEFORE -
        1 -
        (isQueryCompleteBefore ? 0 : 1);
    let wordsBeforeAsString = wordsBeforeQuery.slice(startWordIndex <= 0 ? 0 : startWordIndex).join(" ") +
        (isQueryCompleteBefore ? " " : "");
    const MAX_ALLOWED_CHARS = 20;
    wordsBeforeAsString =
        wordsBeforeAsString.length > MAX_ALLOWED_CHARS
            ? wordsBeforeAsString.slice(-MAX_ALLOWED_CHARS)
            : wordsBeforeAsString;
    const substrAfterQuery = text.slice(index + searchQuery.length);
    const wordsAfter = substrAfterQuery.split(/\s+/);
    // text = "small", query = "mall", complete after
    // text = "small", query = "smal", not complete after
    const isQueryCompleteAfter = !substrAfterQuery.startsWith(" ");
    const numberOfWordsToTake = isQueryCompleteAfter
        ? WORDS_AFTER + 1
        : WORDS_AFTER;
    const wordsAfterAsString = (isQueryCompleteAfter ? "" : " ") +
        wordsAfter.slice(0, numberOfWordsToTake).join(" ");
    return {
        indexInSearchQuery: wordsBeforeAsString.length,
        previewText: wordsBeforeAsString + searchQuery + wordsAfterAsString,
        moreBefore: startWordIndex > 0,
        moreAfter: wordsAfter.length > numberOfWordsToTake,
    };
};
const normalizeWrappedText = (wrappedText, originalText) => {
    const wrappedLines = wrappedText.split("\n");
    const normalizedLines = [];
    let originalIndex = 0;
    for (let i = 0; i < wrappedLines.length; i++) {
        let currentLine = wrappedLines[i];
        const nextLine = wrappedLines[i + 1];
        if (nextLine) {
            const nextLineIndexInOriginal = originalText.indexOf(nextLine, originalIndex);
            if (nextLineIndexInOriginal > currentLine.length + originalIndex) {
                let j = nextLineIndexInOriginal - (currentLine.length + originalIndex);
                while (j > 0) {
                    currentLine += " ";
                    j--;
                }
            }
        }
        normalizedLines.push(currentLine);
        originalIndex = originalIndex + currentLine.length;
    }
    return normalizedLines.join("\n");
};
const getMatchedLines = (textElement, searchQuery, index) => {
    const normalizedText = normalizeWrappedText(textElement.text, textElement.originalText);
    const lines = normalizedText.split("\n");
    const lineIndexRanges = [];
    let currentIndex = 0;
    let lineNumber = 0;
    for (const line of lines) {
        const startIndex = currentIndex;
        const endIndex = startIndex + line.length - 1;
        lineIndexRanges.push({
            line,
            startIndex,
            endIndex,
            lineNumber,
        });
        // Move to the next line's start index
        currentIndex = endIndex + 1;
        lineNumber++;
    }
    let startIndex = index;
    let remainingQuery = textElement.originalText.slice(index, index + searchQuery.length);
    const matchedLines = [];
    for (const lineIndexRange of lineIndexRanges) {
        if (remainingQuery === "") {
            break;
        }
        if (startIndex >= lineIndexRange.startIndex &&
            startIndex <= lineIndexRange.endIndex) {
            const matchCapacity = lineIndexRange.endIndex + 1 - startIndex;
            const textToStart = lineIndexRange.line.slice(0, startIndex - lineIndexRange.startIndex);
            const matchedWord = remainingQuery.slice(0, matchCapacity);
            remainingQuery = remainingQuery.slice(matchCapacity);
            const offset = measureText(textToStart, getFontString(textElement), textElement.lineHeight, true);
            // measureText returns a non-zero width for the empty string
            // which is not what we're after here, hence the check and the correction
            if (textToStart === "") {
                offset.width = 0;
            }
            if (textElement.textAlign !== "left" && lineIndexRange.line.length > 0) {
                const lineLength = measureText(lineIndexRange.line, getFontString(textElement), textElement.lineHeight, true);
                const spaceToStart = textElement.textAlign === "center"
                    ? (textElement.width - lineLength.width) / 2
                    : textElement.width - lineLength.width;
                offset.width += spaceToStart;
            }
            const { width, height } = measureText(matchedWord, getFontString(textElement), textElement.lineHeight);
            const offsetX = offset.width;
            const offsetY = lineIndexRange.lineNumber * offset.height;
            matchedLines.push({
                offsetX,
                offsetY,
                width,
                height,
            });
            startIndex += matchCapacity;
        }
    }
    return matchedLines;
};
const escapeSpecialCharacters = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
};
const handleSearch = debounce((searchQuery, app, cb) => {
    if (!searchQuery || searchQuery === "") {
        cb([], null);
        return;
    }
    const elements = app.scene.getNonDeletedElements();
    const texts = elements.filter((el) => isTextElement(el));
    texts.sort((a, b) => a.y - b.y);
    const matchItems = [];
    const regex = new RegExp(escapeSpecialCharacters(searchQuery), "gi");
    for (const textEl of texts) {
        let match = null;
        const text = textEl.originalText;
        while ((match = regex.exec(text)) !== null) {
            const preview = getMatchPreview(text, match.index, searchQuery);
            const matchedLines = getMatchedLines(textEl, searchQuery, match.index);
            if (matchedLines.length > 0) {
                matchItems.push({
                    textElement: textEl,
                    searchQuery,
                    preview,
                    index: match.index,
                    matchedLines,
                });
            }
        }
    }
    const visibleIds = new Set(app.visibleElements.map((visibleElement) => visibleElement.id));
    const focusIndex = matchItems.findIndex((matchItem) => visibleIds.has(matchItem.textElement.id)) ?? null;
    cb(matchItems, focusIndex);
}, SEARCH_DEBOUNCE);
