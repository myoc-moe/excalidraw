import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { UI } from "@excalidraw/excalidraw/tests/helpers/ui";
import {
  act,
  fireEvent,
  GlobalTestState,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  waitFor,
} from "@excalidraw/excalidraw/tests/test-utils";
import { vi } from "vitest";

import type { FileId } from "@excalidraw/element/types";

import ExcalidrawApp from "../App";

const { h } = window;

Object.defineProperty(window, "crypto", {
  value: {
    getRandomValues: (arr: number[]) =>
      arr.forEach((v, i) => (arr[i] = Math.floor(Math.random() * 256))),
    subtle: {
      generateKey: () => {},
      exportKey: () => ({ k: "sTdLvMC_M3V8_vGa3UVRDg" }),
    },
  },
});

vi.mock("../../excalidraw-app/data/firebase.ts", () => {
  const loadFromFirebase = async () => null;
  const saveToFirebase = () => {};
  const isSavedToFirebase = () => true;
  const loadFilesFromFirebase = async () => ({
    loadedFiles: [],
    erroredFiles: [],
  });
  const saveFilesToFirebase = async () => ({
    savedFiles: new Map(),
    erroredFiles: new Map(),
  });

  return {
    loadFromFirebase,
    saveToFirebase,
    isSavedToFirebase,
    loadFilesFromFirebase,
    saveFilesToFirebase,
  };
});

vi.mock("socket.io-client", () => {
  return {
    default: () => {
      return {
        close: () => {},
        on: () => {},
        once: () => {},
        off: () => {},
        emit: () => {},
      };
    },
  };
});

const FA = "spoiler-menu-file-a" as FileId;
const FB = "spoiler-menu-file-b" as FileId;
const MARK_KEY = "toggle-spoiler-mark";

const queryItem = (key: string) =>
  UI.queryContextMenu()?.querySelector<HTMLElement>(
    `li[data-testid="${key}"]`,
  ) ?? null;

const image = (id: string, fileId: FileId, x = 0) =>
  API.createElement({
    type: "image",
    id,
    fileId,
    x,
    y: 0,
    width: 100,
    height: 100,
  });

const openMenu = () => {
  fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
    button: 2,
    clientX: 50,
    clientY: 50,
  });
};

describe("spoiler mark menu item in the app", () => {
  beforeAll(() => {
    mockBoundingClientRect();
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  beforeEach(async () => {
    localStorage.clear();
    await render(<ExcalidrawApp />);
    // the host item needs excalidrawAPI, which is set after mount
    await waitFor(() => expect(h.app?.api).toBeDefined());
  });

  it("marks an unmarked file as hidden", async () => {
    const img = image("img", FA);
    API.setElements([img]);
    API.setSelectedElements([img]);
    openMenu();

    const item = queryItem(MARK_KEY);
    expect(item).not.toBeNull();
    expect(item!.textContent).toBe("Mark as spoiler");

    fireEvent.click(item!);
    expect(h.app.api.getSpoileredFiles().get(FA)).toBe("hidden");

    openMenu();
    expect(queryItem("toggleSpoiler")!.textContent).toBe("Show spoiler");
    expect(queryItem(MARK_KEY)!.textContent).toBe("Unmark spoiler");
  });

  it("unmarks a marked file", () => {
    const img = image("img", FA);
    API.setElements([img]);
    API.setSelectedElements([img]);
    act(() => h.app.api.markFileSpoilered(FA, true));
    openMenu();

    const item = queryItem(MARK_KEY);
    expect(item!.textContent).toBe("Unmark spoiler");

    fireEvent.click(item!);
    expect(h.app.api.getSpoileredFiles().has(FA)).toBe(false);
  });

  it("marks both files when only one of two images is marked", () => {
    const imgA = image("img-a", FA, 0);
    const imgB = image("img-b", FB, 0);
    API.setElements([imgA, imgB]);
    API.setSelectedElements([imgA, imgB]);
    act(() => h.app.api.markFileSpoilered(FA, true));
    openMenu();

    const item = queryItem(MARK_KEY);
    expect(item!.textContent).toBe("Mark as spoiler");

    fireEvent.click(item!);
    expect(h.app.api.getSpoileredFiles().get(FA)).toBe("hidden");
    expect(h.app.api.getSpoileredFiles().get(FB)).toBe("hidden");
  });

  it("shows no mark item for a non-image element", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    API.setElements([rect]);
    API.setSelectedElements([rect]);
    openMenu();

    expect(UI.queryContextMenu()).not.toBeNull();
    expect(queryItem(MARK_KEY)).toBeNull();
  });

  it("keeps the Alert ID item for images", () => {
    const img = image("img", FA);
    API.setElements([img]);
    API.setSelectedElements([img]);
    openMenu();

    expect(queryItem("alert-id")).not.toBeNull();
    expect(queryItem(MARK_KEY)).not.toBeNull();
  });
});
