/*global G6, bootstrap*/
"use strict";

function showSearchLoading(button) {
    button.innerHTML = "<span class=\"spinner-border spinner-border-sm me-1\" role=\"status\" aria-hidden=\"true\"></span>Searching...";
}

function hideSearchLoading(button) {
    button.textContent = "Search";
}

async function getPersons(searchWord) {
    const url = "persons";
    try {
        const response = await fetch(`${url}?search=${encodeURIComponent(searchWord)}`);
        if (!response.ok) {
            throw new Error("Network response was not OK");
        }
        return response.json();
    } catch (error) {
        console.error("There has been a problem with your fetch operation:", error);
    }
}

function search(e) {
    e.preventDefault();
    showSearchLoading(e.target);
    // get search parameter
    const selections = $(".search-filter").select2("data");
    const searchSelection = selections.find((element) => element.newTag === true);
    const searchWord = searchSelection === undefined ? "" : searchSelection.text;

    getPersons(searchWord).then((data) => {
        if (data === undefined) {
            // set the sessionStorage to empty array to prevent other actions
            // possibly using outdated search results
            sessionStorage.setItem("persons", JSON.stringify([]));
            updateAlert(null);
            hideSearchLoading(e.target);
            return;
        }
        const persons = data.persons;
        sessionStorage.setItem("persons", JSON.stringify(persons));
        hideSearchLoading(e.target);
        fillTable(filter_persons(persons));
        document.querySelector(".persons-table-container").classList.remove("d-none");
        updateAlert(persons.length);
    });
}

function updateAlert(length) {
    const alertEl = document.querySelector(".search-alert");
    alertEl.classList.remove("d-none");
    alertEl.classList.add("d-inline-block");
    if (length === null) {
        alertEl.textContent = "Search failed!";
        alertEl.classList.remove("alert-success");
        alertEl.classList.add("alert-warning");
    } else {
        alertEl.textContent = `${length} result${length === 1 ? "" : "s"} found (before filtering).`;
        alertEl.classList.remove("alert-warning");
        alertEl.classList.add("alert-success");
    }
}

function convertToGraphData(apiData) {
    apiData.nodes = apiData.nodes.map((node) => {
        node.label = node.properties.name;
        delete node.properties;
        return node;
    });

    // maybe copy values with delete Object.assign(..) instead
    apiData.edges = apiData.relationships.map((rel) => {
        rel.source = rel.startNode;
        rel.target = rel.endNode;
        switch (rel.type) {
            case "ADVISED_BY":
                rel.label = "ADVISED BY";
                break;
            case "MEMBER_OF":
                rel.label = "MEMBER OF";
                break;
            default:
                rel.label = rel.type;
                break;
        }
        return rel;
    });
    delete apiData.relationships;
    return apiData;
}

function getColors() {
    const rootStyle = getComputedStyle(document.documentElement);
    const colors = {
        person: rootStyle.getPropertyValue("--color-person"),
        interest: rootStyle.getPropertyValue("--color-interest"),
        institute: rootStyle.getPropertyValue("--color-institute"),
        faculty: rootStyle.getPropertyValue("--color-faculty"),
        department: rootStyle.getPropertyValue("--color-department"),
        role: rootStyle.getPropertyValue("--color-role"),
        expertise: rootStyle.getPropertyValue("--color-expertise"),
    };
    return colors;
}

function wrapNodeLabels(str, pattern) {
    return str.replace(pattern, "$1\n");
}

/**
 * gets pattern for inserting line breaks at or before the max length with String.replace
 * https://stackoverflow.com/a/51506718/15707077
 * @param {number} maxLength
 */
function getWordWrapPattern(maxLength) {
    return new RegExp(`(?![^\n]{1,${maxLength}}$)([^\n]{1,${maxLength}})\\s`, "g");
}

/**
 *
 * @param {*} apiData
 * @param {*} personId
 * @param {*} containerId
 * @param {*} containerWidth
 * @returns {string} name of the person that the graph is about
 */
function drawG6Graph(apiData, personId, containerId, container){
    const data = convertToGraphData(apiData);
    const colors = getColors();
    const pattern = getWordWrapPattern(22);
    data.nodes.forEach((node) => {
        node.label = wrapNodeLabels(node.label, pattern);
        node.style = {};
        node.stateStyles = {
            active: {
                lineWidth: 1,
            },
        };
        switch (node.labels[0]) {
            case "Person":
                node.style.fill = colors.person;
                node.stateStyles.active.fill = colors.person;
                break;
            case "ResearchInterest":
                node.style.fill = colors.interest;
                node.stateStyles.active.fill = colors.interest;
                break;
            case "Institute":
                node.style.fill = colors.institute;
                node.stateStyles.active.fill = colors.institute;
                break;
            case "Faculty":
                node.style.fill = colors.faculty;
                node.stateStyles.active.fill = colors.faculty;
                break;
            case "Department":
                node.style.fill = colors.department;
                node.stateStyles.active.fill = colors.department;
                break;
            case "Role":
                node.style.fill = colors.role;
                node.stateStyles.active.fill = colors.role;
                break;
            case "Expertise":
                node.style.fill = colors.expertise;
                node.stateStyles.active.fill = colors.expertise;
                break;
        }
    });
    // highlight the node that the graph is about
    const sourceNode = data.nodes.find((node) => node.id === personId);
    sourceNode.style = {
        ...sourceNode.style,
        lineWidth: 2,
        stroke: "#111111",
        shadowColor: "#555555",
        shadowBlur: 3,
    };

    // TODO: cluster?

    // change this value instead of directly editing renderer and fitView properties
    // because for some reason fitView=true breaks getBBox for svg
    const useCanvas = true;
    const height = 800;
    const graph = new G6.Graph({
        container: containerId,
        width: 1200, // initial value
        height: height,
        defaultNode: {
            type: "ellipse",
            style: {
                fill: "#ffffff",
                lineWidth: 1,
                stroke: "#a5abb6",
                cursor: "grab",
            },
        },
        defaultEdge: {
            style: {
                stroke: "#a5abb6",
                // TODO: fill arrow or make more obvious in other ways
                endArrow: true,
            },
            labelCfg: {
                style: {
                    opacity: 0.7,
                    fill: "#111111",
                },
            },
        },
        renderer: useCanvas ? "canvas" : "svg",
        layout: {
            type: "force2",
            animate: false,
            linkDistance: 280,
            maxSpeed: 1300,
            preventOverlap: true,
        },
        modes: {
            default: ["drag-canvas", "zoom-canvas", "activate-relations", "drag-node"],
        },
        fitView: useCanvas ? true : false,
    });

    graph.data(data);
    graph.render();
    setGraphEvents(graph, container, useCanvas, height);
    return sourceNode.label;
}

function setGraphEvents(graph, container, useCanvas, height) {
    // the resizing for long labels is called in this callback, otherwise it won't
    // work with SVG (likely because it isn't drawn instantly)
    graph.on("afterrender", async () => {
        if (!useCanvas) {
            // wait till svg is actually drawn
            await new Promise((r) => setTimeout(r, 100));
            graph.fitView();
        }
        graph.getNodes().forEach((node) => {
            // find the text shape by its name
            const labelShape = node.getContainer().find((el) => el.get("name") === "text-shape");
            if (labelShape === null) {
                return;
            }
            // get the bounding box of the label
            const labelBBox = labelShape.getBBox();
            graph.updateItem(node, {
                size: [labelBBox.width + 15, labelBBox.height + 20],
            });
        });
        // to turn on animation for dragging nodes
        graph.updateLayout({animate: true});
    });
    graph.on("node:click", nodeToggleFilter);
    if (useCanvas) {
        graph.on("node:dragstart", function (e) {
            graph.layout();
            refreshDraggedNodePosition(e);
        });
        graph.on("node:drag", function (e) {
            refreshDraggedNodePosition(e);
            graph.layout();
        });
        graph.on("node:dragend", function (e) {
            e.item.get("model").fx = null;
            e.item.get("model").fy = null;
        });
    }
    const modalEl = document.getElementById("graphModal");
    modalEl.addEventListener("shown.bs.modal", () => {
        // needs to be called after modal is shown, else container width = 0
        graph.changeSize(container.clientWidth, height);
        graph.fitView();
        hideModalSpinner();
        container.querySelector("canvas, svg").classList.remove("d-none");
    });
    window.addEventListener("resize", () => {
        graph.changeSize(container.clientWidth, height);
    });
}

function refreshDraggedNodePosition(e) {
    const model = e.item.get("model");
    model.fx = e.x;
    model.fy = e.y;
}

function nodeToggleFilter(e) {
    const item = e.item;
    const id = item.get("id");
    const label = item.getModel().labels[0];
    // for person/advisor and offered/wanted expertise toggle both because
    // there is no way to know which the user wanted
    switch (label) {
        case "Person":
            toggleSelection("pers-" + id);
            toggleSelection("advi-" + id);
            break;
        case "ResearchInterest":
            toggleSelection("inte-" + id);
            break;
        case "Institute":
            toggleSelection("inst-" + id);
            break;
        case "Faculty":
            toggleSelection("facu-" + id);
            break;
        case "Department":
            toggleSelection("depa-" + id);
            break;
        case "Role":
            toggleSelection("role-" + id);
            break;
        case "Expertise":
            toggleSelection("offe-" + id);
            toggleSelection("want-" + id);
            break;
    }
}

function showGraph(data, personId) {
    const containerId = "graph-container";
    const container = document.querySelector("#" + containerId);
    const personName = drawG6Graph(data, personId, containerId, container);

    // select the svg or canvas element
    const networkEl = document.querySelector("#" + containerId + " > *");
    networkEl.classList.add("border", "border-info", "rounded", "rounded-1", "d-none");
    networkEl.setAttribute("alt", "Network graph about " + personName);
}

async function getGraph(personId) {
    // what happens in case of timeout?
    const url = "graph";
    try {
        const response = await fetch(`${url}?person=${encodeURIComponent(personId)}`);
        if (!response.ok) {
            throw new Error("Network response was not OK");
        }
        return response.json();
    } catch (error) {
        console.error("There has been a problem with your fetch operation:", error);
    }
}

function makeGraph(e) {
    // don't execute the callback when the email link is clicked
    if (e.target.nodeName === "A") {
        return;
    }

    // for setting focus after modal close
    e.currentTarget.dataset.lastSelected = true;
    makeModal();
    const personId = e.currentTarget.dataset.pk;
    getGraph(personId).then((data) => {
        if (data === undefined) {
            hideModalSpinner();
            document.querySelector("#graph-container").textContent = "Request failed.";
            return;
        }
        showGraph(data.graph, personId);
    });
}

function makeModal() {
    const modalEl = document.getElementById("graphModal");
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
    resetModalContent();
}

function hideModalSpinner() {
    document.querySelector(".graph-spinner").classList.add("d-none");
}

function resetModalContent() {
    document.querySelector(".graph-spinner").classList.remove("d-none");
    document.querySelector("#graph-container").replaceChildren();
}

function group_filters(filters, id) {
    return filters.filter((filter) => filter.id.substring(0, 4) === id);
}

/**
 * return true if any of the values is in the filters list or if filters list is empty
 * @param {Array} filters
 * @param {Array} values
 * @returns {boolean}
 */
function isMatching(filters, values, ignoreEmpty=false) {
    if (filters.length === 0 && !ignoreEmpty) {
        return true;
    }

    // values.forEach can't be used because you can't return from inside it
    for (const value of values) {
        if (filters.some((filter) => filter.id.slice(5) === value.pk)) {
            return true;
        }
    }
    return false;
}

function isMatchingPerson(filters, person, ignoreEmpty=false) {
    if (filters.length === 0 && !ignoreEmpty) {
        return true;
    }

    if (filters.some((filter) => filter.id.slice(5) === person.pk)) {
        return true;
    }
    return false;
}

/**
 * returns filtered array of persons.
 * @param {Array} persons
 */
function filter_persons(persons) {
    const selections = $(".search-filter").select2("data");
    // excluding the user created selections here is only necessary
    // because a user might create a tag with e.g. the value "inst-xxx"
    const filters = selections.filter((element) => element.newTag === undefined);

    // group the filters by category
    // the id is the key prepended to the suggestions in the Django template
    const person_filters = group_filters(filters, "pers");
    const interests_filters = group_filters(filters, "inte");
    const institutes_filters = group_filters(filters, "inst");
    const faculties_filters = group_filters(filters, "facu");
    const departments_filters = group_filters(filters, "depa");
    const roles_filters = group_filters(filters, "role");
    const advisors_filters = group_filters(filters, "advi");
    const offered_filters = group_filters(filters, "offe");
    const wanted_filters = group_filters(filters, "want");

    // filters of different categories are generally connected by AND
    // the persons/advisors and offered/wanted expertise categories use OR
    const filtered = persons.filter((person) => {
        const matchingPersons = isMatchingPerson(person_filters, person.person, true) ||
            isMatching(advisors_filters, person.advisors, true) ||
            (person_filters.length === 0 && advisors_filters.length === 0);
        const matchingExpertise = isMatching(offered_filters, person.offered, true) ||
            isMatching(wanted_filters, person.wanted, true) ||
            (offered_filters.length === 0 && wanted_filters.length === 0);

        return matchingPersons &&
            isMatching(interests_filters, person.interests) &&
            isMatching(institutes_filters, person.institutes) &&
            isMatching(faculties_filters, person.faculties) &&
            isMatching(departments_filters, person.departments) &&
            isMatching(roles_filters, person.roles) &&
            matchingExpertise;
    });
    return filtered;
}

function concatTitleName(title, name) {
    return title === "" ? name : title + " " + name;
}

/**
 * adds the id or removes it if it's already selected
 * @param {string} id
 */
function toggleSelection(id) {
    const $searchFilter = $(".search-filter");
    const values = $searchFilter.val();
    const index = values.indexOf(id);
    if (index === -1) {
        $searchFilter.val([id, ...values]);
    } else {
        // remove the element in-place
        values.splice(index, 1);
        $searchFilter.val(values);
    }
    $searchFilter.trigger("change");
}

function pillClick(e) {
    e.stopPropagation();
    toggleSelection(e.target.dataset.pk);
}

function makePill(text, id) {
    const pill = document.createElement("button");
    pill.classList.add("pill");
    pill.textContent = text;
    pill.dataset.pk = id;
    pill.tabIndex = -1;
    pill.addEventListener("click", pillClick);
    pill.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            e.target.click();
        }
    });
    return pill;
}

/**
 * emulate button behavior for elements that can't be a button, e.g. tr.
 * might not work for buttons in forms
 * @param {HTMLElement} element
 * @param {Function} func the function that will be executed on click and keydown
 */
function emulateButton(element, func) {
    element.setAttribute("role", "button");
    element.tabIndex = -1;
    element.addEventListener("click", func);
    element.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            // prevent scrolling from spacebar input
            e.preventDefault();
            e.target.click();
        }
    });
}

function appendBasicTableCell(tableRow, values, pkPrefix) {
    const td = document.createElement("td");
    values.forEach((value) => {
        // the prefix is needed for select2
        const pk = pkPrefix + "-" + value.pk;
        td.appendChild(makePill(value.name, pk));
    });
    tableRow.appendChild(td);
}

function appendEmailCell(tableRow, email) {
    const container = document.createElement("td");
    tableRow.appendChild(container);
    if (!email) {
        return;
    }
    const emailLink = document.createElement("a");
    emailLink.href = "mailto:" + email;
    emailLink.textContent = email;
    emailLink.tabIndex = -1;
    container.appendChild(emailLink);
}

function fillTable(persons) {
    const tableBody = document.querySelector(".persons-table tbody");
    // remove all children
    tableBody.replaceChildren();
    persons.forEach((p) => {
        const tr = document.createElement("tr");
        tr.dataset.pk = p.person.pk;
        emulateButton(tr, makeGraph);

        const personEl = document.createElement("td");
        const personText = concatTitleName(p.person.title, p.person.name);
        const personPill = makePill(personText, "pers-" + p.person.pk);
        personEl.appendChild(personPill);
        tr.appendChild(personEl);

        appendEmailCell(tr, p.person.email);
        appendBasicTableCell(tr, p.interests, "inte");
        appendBasicTableCell(tr, p.institutes, "inst");
        appendBasicTableCell(tr, p.faculties, "facu");
        appendBasicTableCell(tr, p.departments, "depa");
        // should advisor titles be shown?
        appendBasicTableCell(tr, p.advisors, "advi");
        appendBasicTableCell(tr, p.roles, "role");
        appendBasicTableCell(tr, p.offered, "offe");
        appendBasicTableCell(tr, p.wanted, "want");

        tableBody.appendChild(tr);
    });
    // to enable tabbing into the table
    if (persons.length > 0) {
        tableBody.firstChild.tabIndex = 0;
    }
}

/**
 * handles tabs and arrow key presses in table body
 *
 * left/right switches between the children in a tr.
 * up/down switches between the trs.
 * @param {KeyboardEvent} e
 */
function handleTableFocus(e) {
    switch (e.key) {
        case "ArrowUp":
            changeRowFocus(e, -1);
            break;
        case "ArrowDown":
            changeRowFocus(e, 1);
            break;
        case "ArrowLeft":
            changeRowChildrenFocus(e, -1);
            break;
        case "ArrowRight":
            changeRowChildrenFocus(e, 1);
            break;
        default:
            return;
    }
}

function changeRowFocus(e, direction) {
    const tbody = e.target.closest("tbody");
    const rows = tbody.querySelectorAll("tr");
    const currentRow = document.activeElement.closest("tr");
    const indexCurrentRow = Array.prototype.indexOf.call(rows, currentRow);
    const nextRow = (() => {
        const next = rows[indexCurrentRow + direction];
        // special case in case the activeElement is a child of the first or last row
        return next || rows[direction === -1 ? 0 : rows.length - 1];
    })();
    nextRow.focus();
    e.preventDefault();
}

function changeRowChildrenFocus(e, direction) {
    if (e.target.nodeName === "TR") {
        if (direction === 1) {
            e.target.querySelector("button").focus();
        }
    } else {
        const activeElement = document.activeElement;
        const rowChildren = activeElement.closest("tr").querySelectorAll("button, a");
        const indexActive = Array.prototype.indexOf.call(rowChildren, activeElement);
        const newTarget = rowChildren[indexActive + direction];
        newTarget?.focus();
    }
    e.preventDefault();
}

function initializeTableBody() {
    const tbody = document.querySelector(".persons-table tbody");
    tbody.addEventListener("keydown", handleTableFocus);
    tbody.addEventListener("focusin", (e) => {
        tbody.querySelector("[tabindex='0']").tabIndex = -1;
        // to remember the last focused element in the tbody
        e.target.tabIndex = 0;
    });
}

function initializeSearch() {
    const searchEl = document.querySelector("#search-button");
    searchEl.addEventListener("click", search);
}

function handleMinimize() {
    // should clicking on backdrop minimize or close?
    // and then could I distinguish between pressing escape and clicking backdrop?
    const minimizeEl = document.querySelector(".btn-close.graph-minimize");
    const maximizeEl = document.querySelector(".graph-maximize");
    if (minimizeEl.dataset.usedMinimize) {
        maximizeEl.classList.remove("d-none");
        delete minimizeEl.dataset.usedMinimize;
    } else {
        maximizeEl.classList.add("d-none");
    }
}

function setFocus() {
    const target = document.querySelector("tbody > tr[data-last-selected]");
    delete target.dataset.lastSelected;
    target?.focus();
}

function initializeModal() {
    const modalEl = document.getElementById("graphModal");
    // because this event needs to be triggered before the modal.close it is attached
    // to the modal div and is activated during capture
    modalEl.addEventListener("click", (e) => {
        e.target.dataset.usedMinimize = true;
    }, true);
    modalEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.target.click();
        }
    });
    modalEl.addEventListener("hide.bs.modal", handleMinimize);
    modalEl.addEventListener("hidden.bs.modal", setFocus);
}

function templateResult(item, container) {
    // if I wanted to color the search results, the color of the
    // exclude/highlight states would need to be handled too
    if (item.element) {
        // currently I only use the class for coloring the optgroup
        // so maybe I should only add the class to the optgroups?
        $(container).addClass($(item.element).attr("class"));
    }
    return item.text;
}

function templateSelection(item, container) {
    $(container).addClass($(item.element).attr("class"));

    // for displaying the optgroup name before the element for some groups
    const labels = {
        "Persons": "Person",
        "Advisors": "Advisor",
        "Offered expertise": "Offered",
        "Wanted expertise": "Wanted",
    };
    const option = $(item.element);
    const optgroup = option.closest("optgroup").attr("label");
    const label = labels[optgroup];
    return label ? label + " | " + item.text : item.text;
}

function createTag(params) {
    const selections = $(".search-filter").select2("data");
    const searchSelection = selections.find((element) => element.newTag === true);
    // allow only one tag (= search word)
    if (searchSelection) {
        return null;
    }

    const term = $.trim(params.term);
    if (term === "") {
        return null;
    }

    return {
        id: term,
        text: term,
        newTag: true,
    };
}

function initializeSelect2() {
    const $searchFilter = $(".search-filter").select2({
        placeholder: "Select filters or enter search parameter",
        maximumSelectionLength: 20,
        tags: true,
        tokenSeparators: [","],
        allowClear: true,
        templateSelection: templateSelection,
        templateResult: templateResult,
        createTag: createTag,
        debug: true,
        width: "100%",
    });
    $searchFilter.on("change", function () {
        const persons = JSON.parse(sessionStorage.getItem("persons")) ?? [];
        fillTable(filter_persons(persons));
    });
    // prevents opening the dropdown after unselecting an item
    $searchFilter.on("select2:unselecting", function () {
        $(this).on("select2:opening", function (ev) {
            ev.preventDefault();
            $(this).off("select2:opening");
        });
    });
}

initializeSelect2();
initializeTableBody();
initializeSearch();
initializeModal();

// after refreshing the page the user should have to search again
// if I don't clear the storage it would show the results of the
// previous search as soon as a search word or filter is entered
sessionStorage.removeItem("persons");
