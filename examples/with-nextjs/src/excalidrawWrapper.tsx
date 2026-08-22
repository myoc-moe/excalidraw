"use client";
import * as excalidrawLib from "@excalidraw/excalidraw";
import { Excalidraw } from "@excalidraw/excalidraw";

import "@excalidraw/excalidraw/index.css";

import type { CompressImageFile } from "@excalidraw/excalidraw";

import App from "../../with-script-in-browser/components/ExampleApp";

const compressImageFile: CompressImageFile = async (file) => file;

const ExcalidrawWrapper: React.FC = () => {
  return (
    <>
      <App
        appTitle={"Excalidraw with Nextjs Example"}
        useCustom={(api: any, args?: any[]) => {}}
        excalidrawLib={excalidrawLib}
      >
        <Excalidraw compressImageFile={compressImageFile} />
      </App>
    </>
  );
};

export default ExcalidrawWrapper;
