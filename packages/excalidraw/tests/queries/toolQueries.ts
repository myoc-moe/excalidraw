import { buildQueries, fireEvent, queries } from "@testing-library/react";

import { TOOL_TYPE } from "@excalidraw/common";

import type { ToolType } from "@excalidraw/excalidraw/types";

const _queryAllByToolName = (
  container: HTMLElement,
  tool: ToolType | "lock",
) => {
  const toolTitle = tool === "lock" ? "lock" : TOOL_TYPE[tool];
  const testId = `toolbar-${toolTitle}`;
  let matchingTools = queries.queryAllByTestId(container, testId);

  if (matchingTools.length > 0) {
    return matchingTools;
  }

  const extraToolsTriggers =
    container.ownerDocument.querySelectorAll<HTMLElement>(
      ".App-toolbar__extra-tools-trigger",
    );

  for (const extraToolsTrigger of extraToolsTriggers) {
    fireEvent.click(extraToolsTrigger);
    matchingTools = queries.queryAllByTestId(
      container.ownerDocument.body,
      testId,
    );
    if (matchingTools.length > 0) {
      break;
    }
  }

  return matchingTools;
};

const getMultipleError = (_container: any, tool: any) =>
  `Found multiple elements with tool name: ${tool}`;
const getMissingError = (_container: any, tool: any) =>
  `Unable to find an element with tool name: ${tool}`;

export const [
  queryByToolName,
  getAllByToolName,
  getByToolName,
  findAllByToolName,
  findByToolName,
] = buildQueries<(ToolType | "lock")[]>(
  _queryAllByToolName,
  getMultipleError,
  getMissingError,
);
