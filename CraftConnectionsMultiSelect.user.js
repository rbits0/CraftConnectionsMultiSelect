// ==UserScript==
// @name         CraftConnections Multi-select
// @namespace    rbits.craft-connections-multi-select
// @version      1.0.2
// @description  Multi-select for https://craftconnections.net
// @author       rbits
// @match        https://craftconnections.net/*
// @icon         https://icons.duckduckgo.com/ip2/craftconnections.net.ico
// @grant        GM_addStyle
// @grant        window.onurlchange
// @license      GPL3
// @require      https://cdn.jsdelivr.net/gh/CoeJoder/waitForKeyElements.js@v1.3/waitForKeyElements.js
// @downloadURL  https://github.com/rbits0/CraftConnectionsMultiSelect/raw/refs/heads/main/CraftConnectionsMultiSelect.user.js
// @updateURL    https://github.com/rbits0/CraftConnectionsMultiSelect/raw/refs/heads/main/CraftConnectionsMultiSelect.user.js
// ==/UserScript==

'use strict';


const CSS_NAMESPACE = 'CraftConnectionsMultiSelect';
const ITEMS_PER_GROUP = 4;

let hasScriptRun = false;

const STYLESHEET = `
  .${CSS_NAMESPACE}_item {
    pointer-events: auto !important;
  }

  .${CSS_NAMESPACE}_group1 {
    background-color: #507255 !important;
  }

  .${CSS_NAMESPACE}_group2 {
    background-color: #4c678a !important;
  }

  .${CSS_NAMESPACE}_group3 {
    background-color: #6c5c9c !important;
  }
`;

function run() {
  console.log("CraftConnections Multi-select running");

  GM_addStyle(STYLESHEET);

  const grid = document.body.querySelector(".grid");
  const items = grid.childNodes;
  const toCallOriginalOnclick = []
  window._CraftConnectionsMultiSelect = {
    selectedItems: [],
    selectGroups: [],
    toCallOriginalOnclick,
  }

  for (const item of items) {
    item.tampermonkeyClasses = new Set();

    addItemCss(item);

    item.onclick = (event) => {
      if (toCallOriginalOnclick.includes(item)) {
        // If item is in toCallOriginalOnclick, don't do anything
        // Remove it from toCallOriginalOnclick
        toCallOriginalOnclick.splice(toCallOriginalOnclick.indexOf(item), 1);
      } else {
        event.stopPropagation();
        toggleItemSelected(item);
      }
    }

    item.addEventListener("click", item.onclick);
  }

  const deselectButton = document.evaluate(
    "//button[contains(text(), 'Deselect All')]",
    document.body,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null,
  ).singleNodeValue;
  deselectButton.addEventListener("click", onDeselectButtonClick);

  // Watch for added children to grid
  const gridObserver = new MutationObserver((mutationList) => {
    for (const mutation of mutationList) {
      if (
        mutation.addedNodes.length > 0
        && mutation.addedNodes[0].nodeName === "DIV"
      ) {
        // Child has been added to grid.
        // That means a correct guess was submitted.
        onCorrectGuess();
      }
    }
  })
  gridObserver.observe(grid, {
    childList: true,
  })

  // Watch for CSS changes, to re-add CSS if needed
  const cssObserver = new MutationObserver((mutationList) => {
    for (const mutation of mutationList) {
      if (
        mutation.attributeName === "class"
        && mutation.target.nodeName === "BUTTON"
      ) {
        reAddItemCss(mutation.target);
      }
    }
  });
  cssObserver.observe(grid, {
    subtree: true,
    attributeFilter: ["class"],
  });
}


function toggleItemSelected(item) {
  // const item = new HTMLElement();
  const selectedItems = window._CraftConnectionsMultiSelect.selectedItems;
  // const selectedItems = [new HTMLElement()];

  if (selectedItems.includes(item)) {
    unselect(item);
  } else {
    select(item);
  }
}


/** Returns number of the selectGroup it was in
 */
function unselect(item) {
  const selectedItems = window._CraftConnectionsMultiSelect.selectedItems;
  // const selectedItems = [new HTMLElement()];
  const selectGroups = window._CraftConnectionsMultiSelect.selectGroups;
  // const selectGroups = [[new HTMLElement()]];


  // Remove from selectedItems
  selectedItems.splice(selectedItems.indexOf(item), 1);
  // Remove from selectGroups
  const selectGroupIndex = selectGroups.findIndex(group => (
    group.includes(item)
  ))
  const selectGroup = selectGroups[selectGroupIndex];
  selectGroup.splice(selectGroup.indexOf(item), 1);

  // Remove CSS style
  removeGroupCss(item, selectGroupIndex);

  // Remove selectGroup if empty
  if (selectGroup.length === 0) {
    removeSelectGroup(selectGroupIndex);
  }

  // If item was in first selectGroup, click to deselect it
  if (selectGroupIndex === 0) {
    callOriginalOnclick(item);
  }

  return selectGroupIndex;
}


/** Returns number of the selectGroup it's added to
 */
function select(item) {
  const selectedItems = window._CraftConnectionsMultiSelect.selectedItems;
  // const selectedItems = [new HTMLElement()];
  const selectGroups = window._CraftConnectionsMultiSelect.selectGroups;
  // const selectGroups = [[new HTMLElement()]];

  // Add to selectedItems
  selectedItems.push(item);
  // Add to selectGroup
  const selectGroupIndex = findSelectGroupSpace(item);
  selectGroups[selectGroupIndex].push(item);
  
  // Add CSS style
  addGroupCss(item, selectGroupIndex);

  // Properly select item if it's in the first selectGroup
  if (selectGroupIndex === 0) {
    callOriginalOnclick(item);
  }

  return selectGroupIndex;
}

/** Removes selectGroup and shifts other groups up
 */
function removeSelectGroup(index) {
  const selectGroups = window._CraftConnectionsMultiSelect.selectGroups;
  // const selectGroups = [[new HTMLElement()]];
  selectGroups.splice(index, 1);

  // Replace css for all items in groups that were shifted
  for (let i = index; i < selectGroups.length; i++) {
    const selectGroup = selectGroups[i];

    for (const item of selectGroup) {
      removeGroupCss(item, i + 1);
      addGroupCss(item, i);
    }
  }

  // Properly select items in first selectGroup if group removed was first
  if (index === 0 && selectGroups.length > 0) {
    // for (const item of selectGroups[0]) {
    //   callOriginalOnclick(item);
    // }
    clickItems(selectGroups[0]);
  }
}


async function clickItems(items) {
    for (item of items) {
      await sleep(1);
      callOriginalOnclick(item);
    }
}


function removeGroupCss(item, selectGroupIndex) {
  const className = `${CSS_NAMESPACE}_group${selectGroupIndex}`;
  item.classList.remove(className);
  item.tampermonkeyClasses.delete(className);
}

function addGroupCss(item, selectGroupIndex) {
  const className = `${CSS_NAMESPACE}_group${selectGroupIndex}`;
  item.classList.add(className);
  item.tampermonkeyClasses.add(className);
}

function addItemCss(item) {
  const className = `${CSS_NAMESPACE}_item`;
  item.classList.add(className);
  item.tampermonkeyClasses.add(className);
}

function reAddItemCss(item) {
  // Check if classList is missing a class from tampermonkeyClasses
  if (
    item.hasOwnProperty("tampermonkeyClasses")
    && !item.classList.contains(item.tampermonkeyClasses.values().next().value)
  ) {
    // Add all the classes to classList
    for (className of item.tampermonkeyClasses) {
      item.classList.add(className);
    }
  }
}


/**
 * Returns index of selectGroup.
 * 
 * Creates selectGroup if none is found.
 */
function findSelectGroupSpace(item) {
  const selectGroups = window._CraftConnectionsMultiSelect.selectGroups;
  // const selectGroups = [[new HTMLElement()]];

  let selectGroupIndex = selectGroups.findIndex(selectGroup => (
    selectGroup.length < ITEMS_PER_GROUP
  ))

  if (selectGroupIndex === -1) {
    // No selectGroup found
    selectGroups.push([]);
    return selectGroups.length - 1;
  } else {
    return selectGroupIndex;
  }
}


function callOriginalOnclick(item) {
  const toCallOriginalOnclick = window._CraftConnectionsMultiSelect.toCallOriginalOnclick;
  toCallOriginalOnclick.push(item);

  const event = new PointerEvent("click", {
    bubbles: true,
  });

  item.dispatchEvent(event);
}


function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, ms);
  })
}


function onDeselectButtonClick(_event) {
  const selectedItems = window._CraftConnectionsMultiSelect.selectedItems;
  // const selectedItems = [new HTMLElement()];
  const selectGroups = window._CraftConnectionsMultiSelect.selectGroups;
  // const selectGroups = [[new HTMLElement()]];

  // Remove all selected items
  selectedItems.splice(0);

  // Remove all selectGroups (and their CSS styles)
  for (const [i, selectGroup] of selectGroups.entries()) {
    for (const item of selectGroup) {
      removeGroupCss(item, i);
    }
  }
  selectGroups.splice(0);
}


function onCorrectGuess() {
  const selectedItems = window._CraftConnectionsMultiSelect.selectedItems;
  // const selectedItems = [new HTMLElement()];
  const selectGroups = window._CraftConnectionsMultiSelect.selectGroups;
  // const selectGroups = [[new HTMLElement()]];

  const submittedGroup = selectGroups[0];
  for (item of submittedGroup) {
    selectedItems.splice(selectedItems.indexOf(item), 1);
  }

  removeSelectGroup(0);
}



if (
  window.location.href.startsWith('https://craftconnections.net/puzzle/') ||
  window.location.href === 'https://craftconnections.net/'
) {
  waitForKeyElements('.grid > button', () => {
    if (!hasScriptRun) {
      hasScriptRun = true;
      run();

      listenForUrlChange();
    }
  });
} else {
  listenForUrlChange();
}


function listenForUrlChange() {
  if (window.onurlchange === null) {
    // onurlchange supported

    window.addEventListener("urlchange", (info) => {
      if (info.url.startsWith("https://craftconnections.net/puzzle/")) {
        // Re-run the script for the new page
        hasScriptRun = false;

        waitForKeyElements(".grid > button", () => {
          if (!hasScriptRun) {
            hasScriptRun = true;
            run();
          }
        });
      }
    });
  }
}