"use strict";

const DATA_URL = "./internships.json";

const elements = {
    form: document.querySelector("#filter-form"),
    search: document.querySelector("#search-input"),
    domain: document.querySelector("#domain-filter"),
    type: document.querySelector("#type-filter"),
    sort: document.querySelector("#sort-filter"),

    grid: document.querySelector("#internship-grid"),
    count: document.querySelector("#results-count"),

    empty: document.querySelector("#empty-state"),
    error: document.querySelector("#error-state"),

    retry: document.querySelector("#retry-button"),
    emptyReset: document.querySelector("#empty-reset-button")
};

let internships = [];
let loadFailed = false;
let searchTimer;

/* Escape untrusted text before inserting it into HTML. */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}

/* Load the internship records from JSON. */

async function loadInternships() {
    loadFailed = false;

    elements.error.hidden = true;
    elements.empty.hidden = true;
    elements.grid.replaceChildren();

    elements.count.textContent = "Loading internships...";

    try {
        const response = await fetch(DATA_URL, {
            headers: {
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error("Invalid internship dataset.");
        }

        internships = data.filter(item =>
            item &&
            Number.isFinite(Number(item.id)) &&
            typeof item.role === "string" &&
            typeof item.company === "string" &&
            typeof item.domain === "string" &&
            Array.isArray(item.skills)
        );

        if (internships.length === 0) {
            throw new Error("No valid internship records found.");
        }

        populateDomainFilter();

        loadFailed = false;

        renderInternships();

    } catch (error) {
        console.error("Unable to load internship records:", error);

        loadFailed = true;

        elements.grid.replaceChildren();
        elements.empty.hidden = true;
        elements.error.hidden = false;

        elements.count.textContent =
            "Internships could not be loaded.";
    }
}

/* Build the domain dropdown from available data. */

function populateDomainFilter() {
    const selectedDomain = elements.domain.value;

    const domains = [
        ...new Set(
            internships
                .map(item => item.domain)
                .filter(Boolean)
        )
    ].sort((a, b) => a.localeCompare(b));

    elements.domain.replaceChildren();

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All domains";

    elements.domain.append(allOption);

    domains.forEach(domain => {
        const option = document.createElement("option");

        option.value = domain;
        option.textContent = domain;

        elements.domain.append(option);
    });

    if (domains.includes(selectedDomain)) {
        elements.domain.value = selectedDomain;
    }
}

/* Format a date safely for display. */

function formatDate(dateString) {
    if (!dateString) {
        return "Date unavailable";
    }

    const date = new Date(`${dateString}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return "Date unavailable";
    }

    return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(date);
}

/* Create one reusable internship card. */
function createInternshipCard(internship) {
    const card = document.createElement("article");

    card.className = "internship-card";

    const skills = internship.skills
        .slice(0, 4)
        .map(skill => `
            <span class="skill-tag">
                ${escapeHTML(skill)}
            </span>
        `)
        .join("");

    const companyInitials = internship.company
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(word => word[0])
        .join("")
        .toUpperCase();

    const allowedModes = ["Remote", "Hybrid", "On-site"];

    const mode = allowedModes.includes(internship.mode)
        ? internship.mode
        : "Not specified";

    card.innerHTML = `
        <div class="card-top">
            <div
                class="company-mark"
                aria-label="${escapeHTML(internship.company)} initials"
            >
                ${escapeHTML(companyInitials)}
            </div>

            <span class="domain-tag">
                ${escapeHTML(internship.domain)}
            </span>
        </div>

        <h3>${escapeHTML(internship.role)}</h3>

        <p class="company-name">
            ${escapeHTML(internship.company)}
        </p>

        <p class="card-description">
            ${escapeHTML(internship.description)}
        </p>

        <div class="skills-list" aria-label="Required skills">
            ${skills}
        </div>

        <div class="card-details">
            <div class="detail-item">
                <span class="detail-label">Work mode</span>
                <span class="detail-value">${escapeHTML(mode)}</span>
            </div>

            <div class="detail-item">
                <span class="detail-label">Duration</span>
                <span class="detail-value">
                    ${escapeHTML(internship.duration || "Not specified")}
                </span>
            </div>

            <div class="detail-item">
                <span class="detail-label">Stipend</span>
                <span class="detail-value">
                    ${escapeHTML(internship.stipend || "Not specified")}
                </span>
            </div>

            <div class="detail-item">
                <span class="detail-label">Location</span>
                <span class="detail-value">
                    ${escapeHTML(internship.location || "Not specified")}
                </span>
            </div>
        </div>

        <div class="card-footer">
            <span class="posted-date">
                Posted ${escapeHTML(formatDate(internship.postedDate))}
            </span>

            <button
                type="button"
                class="apply-link details-button"
                data-internship-id="${escapeHTML(String(internship.id))}"
                aria-label="View details for ${escapeHTML(internship.role)}"
            >
                View details →
            </button>
        </div>
    `;

    return card;
}
/* Open internship details when a card button is clicked. */

const detailsDialog = document.getElementById("details-dialog");
const dialogTitle = document.getElementById("dialog-title");
const dialogBody = document.getElementById("dialog-body");
const closeDialogButton = document.getElementById("close-dialog");

elements.grid.addEventListener("click", function (event) {
    const button = event.target.closest("[data-internship-id]");

    if (!button) {
        return;
    }

    const selectedInternship = internships.find(
        internship =>
            String(internship.id) === button.dataset.internshipId
    );

    if (!selectedInternship) {
        return;
    }

    dialogTitle.textContent = selectedInternship.role;
    dialogBody.replaceChildren();

    const description = document.createElement("p");
    description.textContent = selectedInternship.description;
    dialogBody.appendChild(description);

    const details = [
        ["Company", selectedInternship.company],
        ["Domain", selectedInternship.domain],
        ["Work mode", selectedInternship.mode],
        ["Duration", selectedInternship.duration],
        ["Stipend", selectedInternship.stipend],
        ["Location", selectedInternship.location],
        ["Required skills", selectedInternship.skills.join(", ")],
        ["Posted date", formatDate(selectedInternship.postedDate)]
    ];

    const list = document.createElement("dl");
    list.className = "dialog-details-list";

    details.forEach(([label, value]) => {
        const term = document.createElement("dt");
        term.textContent = label;

        const description = document.createElement("dd");
        description.textContent = value || "Not specified";

        list.append(term, description);
    });

    dialogBody.appendChild(list);

    detailsDialog.showModal();
});

closeDialogButton.addEventListener("click", function () {
    detailsDialog.close();
});

/* Close the popup when the user clicks its backdrop. */

detailsDialog.addEventListener("click", function (event) {
    if (event.target === detailsDialog) {
        detailsDialog.close();
    }
});

/* Render all matching internship cards. */

function renderInternships() {
    if (loadFailed) {
        return;
    }

    const filtered = getFilteredInternships();

    const fragment = document.createDocumentFragment();

    filtered.forEach(internship => {
        fragment.append(createInternshipCard(internship));
    });

    elements.grid.replaceChildren(fragment);

    elements.count.replaceChildren();

    const countText = document.createElement("strong");

    countText.textContent = String(filtered.length);

    elements.count.append(
        countText,
        document.createTextNode(
            filtered.length === 1
                ? " internship found"
                : " internships found"
        )
    );

    const isEmpty = filtered.length === 0;

    elements.empty.hidden = !isEmpty;
    elements.error.hidden = true;
    elements.grid.hidden = isEmpty;
}

/* Reset filters and show all records. */

function resetFilters() {
    elements.form.reset();
    elements.sort.value = "newest";

    renderInternships();

    elements.search.focus();
}

/* Search input uses a short debounce. */

elements.search.addEventListener("input", () => {
    window.clearTimeout(searchTimer);

    searchTimer = window.setTimeout(() => {
        renderInternships();
    }, 150);
});

/* Update results when a filter changes. */

elements.domain.addEventListener("change", renderInternships);
elements.type.addEventListener("change", renderInternships);
elements.sort.addEventListener("change", renderInternships);

/* Prevent the form's reset event from racing with the UI update. */

elements.form.addEventListener("reset", event => {
    event.preventDefault();
    resetFilters();
});

elements.retry.addEventListener("click", loadInternships);

elements.emptyReset.addEventListener("click", resetFilters);

/* Start the application. */

loadInternships();

/* Filter and sort internship records. */

function getFilteredInternships() {
    const query = elements.search.value
        .trim()
        .toLowerCase();

    const domain = elements.domain.value;
    const mode = elements.type.value;
    const sort = elements.sort.value;

    const filtered = internships.filter(internship => {
        const searchableText = [
            internship.role,
            internship.company,
            internship.domain,
            internship.location,
            internship.description,
            ...(internship.skills || [])
        ]
            .join(" ")
            .toLowerCase();

        const matchesSearch = searchableText.includes(query);

        const matchesDomain =
            domain === "all" || internship.domain === domain;

        const matchesMode =
            mode === "all" || internship.mode === mode;

        return matchesSearch && matchesDomain && matchesMode;
    });

    if (sort === "company") {
        filtered.sort((a, b) =>
            a.company.localeCompare(b.company)
        );
    } else if (sort === "role") {
        filtered.sort((a, b) =>
            a.role.localeCompare(b.role)
        );
    } else {
        filtered.sort((a, b) =>
            new Date(b.postedDate) - new Date(a.postedDate)
        );
    }

    return filtered;
}