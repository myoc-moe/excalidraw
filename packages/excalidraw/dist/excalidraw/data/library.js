import { loadLibraryFromBlob } from "./blob";
import { restoreLibraryItems } from "./restore";
import { atom } from "jotai";
import { jotaiStore } from "../jotai";
import { getCommonBoundingBox } from "../element/bounds";
import { AbortError } from "../errors";
import { t } from "../i18n";
import { useEffect, useRef } from "react";
import { URL_HASH_KEYS, URL_QUERY_KEYS, APP_NAME, EVENT, DEFAULT_SIDEBAR, LIBRARY_SIDEBAR_TAB, } from "../constants";
import { libraryItemSvgsCache } from "../hooks/useLibraryItemSvg";
import { arrayToMap, cloneJSON, preventUnload, promiseTry, resolvablePromise, } from "../utils";
import { Emitter } from "../emitter";
import { Queue } from "../queue";
import { hashElementsVersion, hashString } from "../element";
import { toValidURL } from "./url";
const ALLOWED_LIBRARY_HOSTNAMES = ["excalidraw.com"];
const onLibraryUpdateEmitter = new Emitter();
export const libraryItemsAtom = atom({ status: "loaded", isInitialized: false, libraryItems: [] });
const cloneLibraryItems = (libraryItems) => cloneJSON(libraryItems);
/**
 * checks if library item does not exist already in current library
 */
const isUniqueItem = (existingLibraryItems, targetLibraryItem) => {
    return !existingLibraryItems.find((libraryItem) => {
        if (libraryItem.elements.length !== targetLibraryItem.elements.length) {
            return false;
        }
        // detect z-index difference by checking the excalidraw elements
        // are in order
        return libraryItem.elements.every((libItemExcalidrawItem, idx) => {
            return (libItemExcalidrawItem.id === targetLibraryItem.elements[idx].id &&
                libItemExcalidrawItem.versionNonce ===
                    targetLibraryItem.elements[idx].versionNonce);
        });
    });
};
/** Merges otherItems into localItems. Unique items in otherItems array are
    sorted first. */
export const mergeLibraryItems = (localItems, otherItems) => {
    const newItems = [];
    for (const item of otherItems) {
        if (isUniqueItem(localItems, item)) {
            newItems.push(item);
        }
    }
    return [...newItems, ...localItems];
};
/**
 * Returns { deletedItems, addedItems } maps of all added and deleted items
 * since last onLibraryChange event.
 *
 * Host apps are recommended to diff with the latest state they have.
 */
const createLibraryUpdate = (prevLibraryItems, nextLibraryItems) => {
    const nextItemsMap = arrayToMap(nextLibraryItems);
    const update = {
        deletedItems: new Map(),
        addedItems: new Map(),
    };
    for (const item of prevLibraryItems) {
        if (!nextItemsMap.has(item.id)) {
            update.deletedItems.set(item.id, item);
        }
    }
    const prevItemsMap = arrayToMap(prevLibraryItems);
    for (const item of nextLibraryItems) {
        if (!prevItemsMap.has(item.id)) {
            update.addedItems.set(item.id, item);
        }
    }
    return update;
};
class Library {
    /** latest libraryItems */
    currLibraryItems = [];
    /** snapshot of library items since last onLibraryChange call */
    prevLibraryItems = cloneLibraryItems(this.currLibraryItems);
    app;
    constructor(app) {
        this.app = app;
    }
    updateQueue = [];
    getLastUpdateTask = () => {
        return this.updateQueue[this.updateQueue.length - 1];
    };
    notifyListeners = () => {
        if (this.updateQueue.length > 0) {
            jotaiStore.set(libraryItemsAtom, (s) => ({
                status: "loading",
                libraryItems: this.currLibraryItems,
                isInitialized: s.isInitialized,
            }));
        }
        else {
            jotaiStore.set(libraryItemsAtom, {
                status: "loaded",
                libraryItems: this.currLibraryItems,
                isInitialized: true,
            });
            try {
                const prevLibraryItems = this.prevLibraryItems;
                this.prevLibraryItems = cloneLibraryItems(this.currLibraryItems);
                const nextLibraryItems = cloneLibraryItems(this.currLibraryItems);
                this.app.props.onLibraryChange?.(nextLibraryItems);
                // for internal use in `useHandleLibrary` hook
                onLibraryUpdateEmitter.trigger(createLibraryUpdate(prevLibraryItems, nextLibraryItems), nextLibraryItems);
            }
            catch (error) {
                console.error(error);
            }
        }
    };
    /** call on excalidraw instance unmount */
    destroy = () => {
        this.updateQueue = [];
        this.currLibraryItems = [];
        jotaiStore.set(libraryItemSvgsCache, new Map());
        // TODO uncomment after/if we make jotai store scoped to each excal instance
        // jotaiStore.set(libraryItemsAtom, {
        //   status: "loading",
        //   isInitialized: false,
        //   libraryItems: [],
        // });
    };
    resetLibrary = () => {
        return this.setLibrary([]);
    };
    /**
     * @returns latest cloned libraryItems. Awaits all in-progress updates first.
     */
    getLatestLibrary = () => {
        return new Promise(async (resolve) => {
            try {
                const libraryItems = await (this.getLastUpdateTask() ||
                    this.currLibraryItems);
                if (this.updateQueue.length > 0) {
                    resolve(this.getLatestLibrary());
                }
                else {
                    resolve(cloneLibraryItems(libraryItems));
                }
            }
            catch (error) {
                return resolve(this.currLibraryItems);
            }
        });
    };
    // NOTE this is a high-level public API (exposed on ExcalidrawAPI) with
    // a slight overhead (always restoring library items). For internal use
    // where merging isn't needed, use `library.setLibrary()` directly.
    updateLibrary = async ({ libraryItems, prompt = false, merge = false, openLibraryMenu = false, defaultStatus = "unpublished", }) => {
        if (openLibraryMenu) {
            this.app.setState({
                openSidebar: { name: DEFAULT_SIDEBAR.name, tab: LIBRARY_SIDEBAR_TAB },
            });
        }
        return this.setLibrary(() => {
            return new Promise(async (resolve, reject) => {
                try {
                    const source = await (typeof libraryItems === "function" &&
                        !(libraryItems instanceof Blob)
                        ? libraryItems(this.currLibraryItems)
                        : libraryItems);
                    let nextItems;
                    if (source instanceof Blob) {
                        nextItems = await loadLibraryFromBlob(source, defaultStatus);
                    }
                    else {
                        nextItems = restoreLibraryItems(source, defaultStatus);
                    }
                    if (!prompt ||
                        window.confirm(t("alerts.confirmAddLibrary", {
                            numShapes: nextItems.length,
                        }))) {
                        if (prompt) {
                            // focus container if we've prompted. We focus conditionally
                            // lest `props.autoFocus` is disabled (in which case we should
                            // focus only on user action such as prompt confirm)
                            this.app.focusContainer();
                        }
                        if (merge) {
                            resolve(mergeLibraryItems(this.currLibraryItems, nextItems));
                        }
                        else {
                            resolve(nextItems);
                        }
                    }
                    else {
                        reject(new AbortError());
                    }
                }
                catch (error) {
                    reject(error);
                }
            });
        });
    };
    setLibrary = (
    /**
     * LibraryItems that will replace current items. Can be a function which
     * will be invoked after all previous tasks are resolved
     * (this is the prefered way to update the library to avoid race conditions,
     * but you'll want to manually merge the library items in the callback
     *  - which is what we're doing in Library.importLibrary()).
     *
     * If supplied promise is rejected with AbortError, we swallow it and
     * do not update the library.
     */
    libraryItems) => {
        const task = new Promise(async (resolve, reject) => {
            try {
                await this.getLastUpdateTask();
                if (typeof libraryItems === "function") {
                    libraryItems = libraryItems(this.currLibraryItems);
                }
                this.currLibraryItems = cloneLibraryItems(await libraryItems);
                resolve(this.currLibraryItems);
            }
            catch (error) {
                reject(error);
            }
        })
            .catch((error) => {
            if (error.name === "AbortError") {
                console.warn("Library update aborted by user");
                return this.currLibraryItems;
            }
            throw error;
        })
            .finally(() => {
            this.updateQueue = this.updateQueue.filter((_task) => _task !== task);
            this.notifyListeners();
        });
        this.updateQueue.push(task);
        this.notifyListeners();
        return task;
    };
}
export default Library;
export const distributeLibraryItemsOnSquareGrid = (libraryItems) => {
    const PADDING = 50;
    const ITEMS_PER_ROW = Math.ceil(Math.sqrt(libraryItems.length));
    const resElements = [];
    const getMaxHeightPerRow = (row) => {
        const maxHeight = libraryItems
            .slice(row * ITEMS_PER_ROW, row * ITEMS_PER_ROW + ITEMS_PER_ROW)
            .reduce((acc, item) => {
            const { height } = getCommonBoundingBox(item.elements);
            return Math.max(acc, height);
        }, 0);
        return maxHeight;
    };
    const getMaxWidthPerCol = (targetCol) => {
        let index = 0;
        let currCol = 0;
        let maxWidth = 0;
        for (const item of libraryItems) {
            if (index % ITEMS_PER_ROW === 0) {
                currCol = 0;
            }
            if (currCol === targetCol) {
                const { width } = getCommonBoundingBox(item.elements);
                maxWidth = Math.max(maxWidth, width);
            }
            index++;
            currCol++;
        }
        return maxWidth;
    };
    let colOffsetX = 0;
    let rowOffsetY = 0;
    let maxHeightCurrRow = 0;
    let maxWidthCurrCol = 0;
    let index = 0;
    let col = 0;
    let row = 0;
    for (const item of libraryItems) {
        if (index && index % ITEMS_PER_ROW === 0) {
            rowOffsetY += maxHeightCurrRow + PADDING;
            colOffsetX = 0;
            col = 0;
            row++;
        }
        if (col === 0) {
            maxHeightCurrRow = getMaxHeightPerRow(row);
        }
        maxWidthCurrCol = getMaxWidthPerCol(col);
        const { minX, minY, width, height } = getCommonBoundingBox(item.elements);
        const offsetCenterX = (maxWidthCurrCol - width) / 2;
        const offsetCenterY = (maxHeightCurrRow - height) / 2;
        resElements.push(
        // eslint-disable-next-line no-loop-func
        ...item.elements.map((element) => ({
            ...element,
            x: element.x +
                // offset for column
                colOffsetX +
                // offset to center in given square grid
                offsetCenterX -
                // subtract minX so that given item starts at 0 coord
                minX,
            y: element.y +
                // offset for row
                rowOffsetY +
                // offset to center in given square grid
                offsetCenterY -
                // subtract minY so that given item starts at 0 coord
                minY,
        })));
        colOffsetX += maxWidthCurrCol + PADDING;
        index++;
        col++;
    }
    return resElements;
};
const validateLibraryUrl = (libraryUrl, 
/**
 * If supplied, takes precedence over the default whitelist.
 * Return `true` if the URL is valid.
 */
validator) => {
    if (validator
        ? validator(libraryUrl)
        : ALLOWED_LIBRARY_HOSTNAMES.includes(new URL(libraryUrl).hostname.split(".").slice(-2).join("."))) {
        return true;
    }
    console.error(`Invalid or disallowed library URL: "${libraryUrl}"`);
    throw new Error("Invalid or disallowed library URL");
};
export const parseLibraryTokensFromUrl = () => {
    const libraryUrl = 
    // current
    new URLSearchParams(window.location.hash.slice(1)).get(URL_HASH_KEYS.addLibrary) ||
        // legacy, kept for compat reasons
        new URLSearchParams(window.location.search).get(URL_QUERY_KEYS.addLibrary);
    const idToken = libraryUrl
        ? new URLSearchParams(window.location.hash.slice(1)).get("token")
        : null;
    return libraryUrl ? { libraryUrl, idToken } : null;
};
class AdapterTransaction {
    static queue = new Queue();
    static async getLibraryItems(adapter, source, _queue = true) {
        const task = () => new Promise(async (resolve, reject) => {
            try {
                const data = await adapter.load({ source });
                resolve(restoreLibraryItems(data?.libraryItems || [], "published"));
            }
            catch (error) {
                reject(error);
            }
        });
        if (_queue) {
            return AdapterTransaction.queue.push(task);
        }
        return task();
    }
    static run = async (adapter, fn) => {
        const transaction = new AdapterTransaction(adapter);
        return AdapterTransaction.queue.push(() => fn(transaction));
    };
    // ------------------
    adapter;
    constructor(adapter) {
        this.adapter = adapter;
    }
    getLibraryItems(source) {
        return AdapterTransaction.getLibraryItems(this.adapter, source, false);
    }
}
let lastSavedLibraryItemsHash = 0;
let librarySaveCounter = 0;
export const getLibraryItemsHash = (items) => {
    return hashString(items
        .map((item) => {
        return `${item.id}:${hashElementsVersion(item.elements)}`;
    })
        .sort()
        .join());
};
const persistLibraryUpdate = async (adapter, update) => {
    try {
        librarySaveCounter++;
        return await AdapterTransaction.run(adapter, async (transaction) => {
            const nextLibraryItemsMap = arrayToMap(await transaction.getLibraryItems("save"));
            for (const [id] of update.deletedItems) {
                nextLibraryItemsMap.delete(id);
            }
            const addedItems = [];
            // we want to merge current library items with the ones stored in the
            // DB so that we don't lose any elements that for some reason aren't
            // in the current editor library, which could happen when:
            //
            // 1. we haven't received an update deleting some elements
            //    (in which case it's still better to keep them in the DB lest
            //     it was due to a different reason)
            // 2. we keep a single DB for all active editors, but the editors'
            //    libraries aren't synced or there's a race conditions during
            //    syncing
            // 3. some other race condition, e.g. during init where emit updates
            //    for partial updates (e.g. you install a 3rd party library and
            //    init from DB only after — we emit events for both updates)
            for (const [id, item] of update.addedItems) {
                if (nextLibraryItemsMap.has(id)) {
                    // replace item with latest version
                    // TODO we could prefer the newer item instead
                    nextLibraryItemsMap.set(id, item);
                }
                else {
                    // we want to prepend the new items with the ones that are already
                    // in DB to preserve the ordering we do in editor (newly added
                    // items are added to the beginning)
                    addedItems.push(item);
                }
            }
            const nextLibraryItems = addedItems.concat(Array.from(nextLibraryItemsMap.values()));
            const version = getLibraryItemsHash(nextLibraryItems);
            if (version !== lastSavedLibraryItemsHash) {
                await adapter.save({ libraryItems: nextLibraryItems });
            }
            lastSavedLibraryItemsHash = version;
            return nextLibraryItems;
        });
    }
    finally {
        librarySaveCounter--;
    }
};
export const useHandleLibrary = (opts) => {
    const { excalidrawAPI } = opts;
    const optsRef = useRef(opts);
    optsRef.current = opts;
    const isLibraryLoadedRef = useRef(false);
    useEffect(() => {
        if (!excalidrawAPI) {
            return;
        }
        // reset on editor remount (excalidrawAPI changed)
        isLibraryLoadedRef.current = false;
        const importLibraryFromURL = async ({ libraryUrl, idToken, }) => {
            const libraryPromise = new Promise(async (resolve, reject) => {
                try {
                    libraryUrl = decodeURIComponent(libraryUrl);
                    libraryUrl = toValidURL(libraryUrl);
                    validateLibraryUrl(libraryUrl, optsRef.current.validateLibraryUrl);
                    const request = await fetch(libraryUrl);
                    const blob = await request.blob();
                    resolve(blob);
                }
                catch (error) {
                    reject(error);
                }
            });
            const shouldPrompt = idToken !== excalidrawAPI.id;
            // wait for the tab to be focused before continuing in case we'll prompt
            // for confirmation
            await (shouldPrompt && document.hidden
                ? new Promise((resolve) => {
                    window.addEventListener("focus", () => resolve(), {
                        once: true,
                    });
                })
                : null);
            try {
                await excalidrawAPI.updateLibrary({
                    libraryItems: libraryPromise,
                    prompt: shouldPrompt,
                    merge: true,
                    defaultStatus: "published",
                    openLibraryMenu: true,
                });
            }
            catch (error) {
                excalidrawAPI.updateScene({
                    appState: {
                        errorMessage: error.message,
                    },
                });
                throw error;
            }
            finally {
                if (window.location.hash.includes(URL_HASH_KEYS.addLibrary)) {
                    const hash = new URLSearchParams(window.location.hash.slice(1));
                    hash.delete(URL_HASH_KEYS.addLibrary);
                    window.history.replaceState({}, APP_NAME, `#${hash.toString()}`);
                }
                else if (window.location.search.includes(URL_QUERY_KEYS.addLibrary)) {
                    const query = new URLSearchParams(window.location.search);
                    query.delete(URL_QUERY_KEYS.addLibrary);
                    window.history.replaceState({}, APP_NAME, `?${query.toString()}`);
                }
            }
        };
        const onHashChange = (event) => {
            event.preventDefault();
            const libraryUrlTokens = parseLibraryTokensFromUrl();
            if (libraryUrlTokens) {
                event.stopImmediatePropagation();
                // If hash changed and it contains library url, import it and replace
                // the url to its previous state (important in case of collaboration
                // and similar).
                // Using history API won't trigger another hashchange.
                window.history.replaceState({}, "", event.oldURL);
                importLibraryFromURL(libraryUrlTokens);
            }
        };
        // -------------------------------------------------------------------------
        // ---------------------------------- init ---------------------------------
        // -------------------------------------------------------------------------
        const libraryUrlTokens = parseLibraryTokensFromUrl();
        if (libraryUrlTokens) {
            importLibraryFromURL(libraryUrlTokens);
        }
        // ------ (A) init load (legacy) -------------------------------------------
        if ("getInitialLibraryItems" in optsRef.current &&
            optsRef.current.getInitialLibraryItems) {
            console.warn("useHandleLibrar `opts.getInitialLibraryItems` is deprecated. Use `opts.adapter` instead.");
            Promise.resolve(optsRef.current.getInitialLibraryItems())
                .then((libraryItems) => {
                excalidrawAPI.updateLibrary({
                    libraryItems,
                    // merge with current library items because we may have already
                    // populated it (e.g. by installing 3rd party library which can
                    // happen before the DB data is loaded)
                    merge: true,
                });
            })
                .catch((error) => {
                console.error(`UseHandeLibrary getInitialLibraryItems failed: ${error?.message}`);
            });
        }
        // -------------------------------------------------------------------------
        // --------------------------------------------------------- init load -----
        // -------------------------------------------------------------------------
        // ------ (B) data source adapter ------------------------------------------
        if ("adapter" in optsRef.current && optsRef.current.adapter) {
            const adapter = optsRef.current.adapter;
            const migrationAdapter = optsRef.current.migrationAdapter;
            const initDataPromise = resolvablePromise();
            // migrate from old data source if needed
            // (note, if `migrate` function is defined, we always migrate even
            //  if the data has already been migrated. In that case it'll be a no-op,
            //  though with several unnecessary steps — we will still load latest
            //  DB data during the `persistLibraryChange()` step)
            // -----------------------------------------------------------------------
            if (migrationAdapter) {
                initDataPromise.resolve(promiseTry(migrationAdapter.load)
                    .then(async (libraryData) => {
                    let restoredData = null;
                    try {
                        // if no library data to migrate, assume no migration needed
                        // and skip persisting to new data store, as well as well
                        // clearing the old store via `migrationAdapter.clear()`
                        if (!libraryData) {
                            return AdapterTransaction.getLibraryItems(adapter, "load");
                        }
                        restoredData = restoreLibraryItems(libraryData.libraryItems || [], "published");
                        // we don't queue this operation because it's running inside
                        // a promise that's running inside Library update queue itself
                        const nextItems = await persistLibraryUpdate(adapter, createLibraryUpdate([], restoredData));
                        try {
                            await migrationAdapter.clear();
                        }
                        catch (error) {
                            console.error(`couldn't delete legacy library data: ${error.message}`);
                        }
                        // migration suceeded, load migrated data
                        return nextItems;
                    }
                    catch (error) {
                        console.error(`couldn't migrate legacy library data: ${error.message}`);
                        // migration failed, load data from previous store, if any
                        return restoredData;
                    }
                })
                    // errors caught during `migrationAdapter.load()`
                    .catch((error) => {
                    console.error(`error during library migration: ${error.message}`);
                    // as a default, load latest library from current data source
                    return AdapterTransaction.getLibraryItems(adapter, "load");
                }));
            }
            else {
                initDataPromise.resolve(promiseTry(AdapterTransaction.getLibraryItems, adapter, "load"));
            }
            // load initial (or migrated) library
            excalidrawAPI
                .updateLibrary({
                libraryItems: initDataPromise.then((libraryItems) => {
                    const _libraryItems = libraryItems || [];
                    lastSavedLibraryItemsHash = getLibraryItemsHash(_libraryItems);
                    return _libraryItems;
                }),
                // merge with current library items because we may have already
                // populated it (e.g. by installing 3rd party library which can
                // happen before the DB data is loaded)
                merge: true,
            })
                .finally(() => {
                isLibraryLoadedRef.current = true;
            });
        }
        // ---------------------------------------------- data source datapter -----
        window.addEventListener(EVENT.HASHCHANGE, onHashChange);
        return () => {
            window.removeEventListener(EVENT.HASHCHANGE, onHashChange);
        };
    }, [
        // important this useEffect only depends on excalidrawAPI so it only reruns
        // on editor remounts (the excalidrawAPI changes)
        excalidrawAPI,
    ]);
    // This effect is run without excalidrawAPI dependency so that host apps
    // can run this hook outside of an active editor instance and the library
    // update queue/loop survives editor remounts
    //
    // This effect is still only meant to be run if host apps supply an persitence
    // adapter. If we don't have access to it, it the update listener doesn't
    // do anything.
    useEffect(() => {
        // on update, merge with current library items and persist
        // -----------------------------------------------------------------------
        const unsubOnLibraryUpdate = onLibraryUpdateEmitter.on(async (update, nextLibraryItems) => {
            const isLoaded = isLibraryLoadedRef.current;
            // we want to operate with the latest adapter, but we don't want this
            // effect to rerun on every adapter change in case host apps' adapter
            // isn't stable
            const adapter = ("adapter" in optsRef.current && optsRef.current.adapter) || null;
            try {
                if (adapter) {
                    if (
                    // if nextLibraryItems hash identical to previously saved hash,
                    // exit early, even if actual upstream state ends up being
                    // different (e.g. has more data than we have locally), as it'd
                    // be low-impact scenario.
                    lastSavedLibraryItemsHash !==
                        getLibraryItemsHash(nextLibraryItems)) {
                        await persistLibraryUpdate(adapter, update);
                    }
                }
            }
            catch (error) {
                console.error(`couldn't persist library update: ${error.message}`, update);
                // currently we only show error if an editor is loaded
                if (isLoaded && optsRef.current.excalidrawAPI) {
                    optsRef.current.excalidrawAPI.updateScene({
                        appState: {
                            errorMessage: t("errors.saveLibraryError"),
                        },
                    });
                }
            }
        });
        const onUnload = (event) => {
            if (librarySaveCounter) {
                preventUnload(event);
            }
        };
        window.addEventListener(EVENT.BEFORE_UNLOAD, onUnload);
        return () => {
            window.removeEventListener(EVENT.BEFORE_UNLOAD, onUnload);
            unsubOnLibraryUpdate();
            lastSavedLibraryItemsHash = 0;
            librarySaveCounter = 0;
        };
    }, [
    // this effect must not have any deps so it doesn't rerun
    ]);
};
