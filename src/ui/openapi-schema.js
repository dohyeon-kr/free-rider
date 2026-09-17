import { el } from "./dom.js";

function typeLabel(schema = {}) {
  if (schema.$ref) return schema.$ref.split("/").pop() || "$ref";
  const type =
    schema.type ||
    (schema.properties ? "object" : schema.items ? "array" : schema.enum ? "enum" : "any");
  return schema.format ? `${type} · ${schema.format}` : type;
}

function requirement(required) {
  return el("span", {
    class: required ? "schema-required" : "schema-optional",
    text: required ? "required" : "optional",
  });
}

function schemaNode(name, schema = {}, required = false, depth = 0) {
  const node = el("div", { class: "schema-node" });
  const line = el(
    "div",
    { class: "schema-node-line" },
    el("code", { class: "schema-node-name", text: name }),
    el("span", { class: "schema-type", text: typeLabel(schema) }),
    requirement(required),
  );
  if (schema.deprecated)
    line.append(el("span", { class: "schema-deprecated", text: "deprecated" }));
  node.append(line);
  if (schema.description)
    node.append(el("div", { class: "schema-description", text: schema.description }));
  if (schema.enum?.length)
    node.append(
      el("div", {
        class: "schema-detail",
        text: `enum · ${schema.enum.slice(0, 6).map(String).join(" · ")}${schema.enum.length > 6 ? " · …" : ""}`,
      }),
    );
  if (depth >= 8) return node;

  const children = [];
  const requiredNames = new Set(schema.required || []);
  for (const [key, value] of Object.entries(schema.properties || {}))
    children.push(schemaNode(key, value, requiredNames.has(key), depth + 1));
  if (schema.items) children.push(schemaNode("items", schema.items, true, depth + 1));
  for (const kind of ["allOf", "oneOf", "anyOf"])
    if (schema[kind]?.length)
      children.push(
        el(
          "div",
          { class: "schema-composition" },
          el("span", { class: "schema-composition-label", text: kind }),
          schema[kind].map((value, index) =>
            schemaNode(`${kind} ${index + 1}`, value, false, depth + 1),
          ),
        ),
      );
  if (schema.additionalProperties && typeof schema.additionalProperties === "object")
    children.push(
      schemaNode("additionalProperties", schema.additionalProperties, false, depth + 1),
    );
  if (children.length)
    node.append(el("div", { class: "schema-children" }, children));
  return node;
}

function blockHeading(title, trailing = null) {
  return el(
    "div",
    { class: "schema-block-heading" },
    el("strong", { text: title }),
    trailing,
  );
}

export function openApiBadge(request) {
  const meta = request?.openapi;
  if (!meta) return null;
  const title = [
    "Imported from OpenAPI",
    meta.document?.title,
    meta.document?.version,
    meta.operationId ? `operationId: ${meta.operationId}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return el("span", {
    class: "pill openapi-pill",
    text: "OpenAPI",
    title,
  });
}

export function parameterSchemaView(request, locations) {
  const allowed = new Set(Array.isArray(locations) ? locations : [locations]);
  const parameters = (request?.openapi?.parameters || []).filter((parameter) =>
    allowed.has(parameter.in),
  );
  if (!parameters.length) return null;
  return el(
    "section",
    { class: "openapi-schema-block parameter-schema" },
    blockHeading("OpenAPI parameters"),
    el(
      "div",
      { class: "parameter-schema-list" },
      parameters.map((parameter) =>
        el(
          "div",
          { class: "parameter-schema-row" },
          el("code", { text: parameter.name }),
          el("span", { class: "schema-location", text: parameter.in }),
          el("span", { class: "schema-type", text: typeLabel(parameter.schema) }),
          requirement(parameter.required),
          parameter.description
            ? el("span", {
                class: "schema-description parameter-description",
                text: parameter.description,
              })
            : null,
        ),
      ),
    ),
  );
}

export function requestBodySchemaView(request) {
  const body = request?.openapi?.requestBody;
  if (!body) return null;
  const contentType = body.contentType || Object.keys(body.content || {})[0] || "";
  const media = body.content?.[contentType] || Object.values(body.content || {})[0];
  return el(
    "section",
    { class: "openapi-schema-block body-schema" },
    blockHeading(
      "OpenAPI request body",
      el(
        "div",
        { class: "schema-heading-meta" },
        contentType ? el("code", { text: contentType }) : null,
        requirement(body.required),
      ),
    ),
    body.description
      ? el("p", { class: "schema-description", text: body.description })
      : null,
    media?.schema
      ? schemaNode("body", media.schema, body.required)
      : el("p", { class: "schema-detail", text: "No request body schema." }),
  );
}

export function responseSchemaView(request) {
  const responses = request?.responses || {};
  const entries = Object.entries(responses);
  const root = el("div", { class: "response-schema" });
  if (!entries.length) {
    root.append(
      el("div", {
        class: "empty-response",
        text: "OpenAPI response schema가 없습니다.",
      }),
    );
    return root;
  }
  for (const [status, response] of entries) {
    const card = el(
      "section",
      { class: "schema-response" },
      el(
        "div",
        { class: "schema-response-heading" },
        el("strong", { text: status }),
        response?.description
          ? el("span", { class: "schema-description", text: response.description })
          : null,
      ),
    );
    const content = Object.entries(response?.content || {});
    if (!content.length) {
      card.append(el("p", { class: "schema-detail", text: "No response body schema." }));
    } else {
      for (const [contentType, media] of content)
        card.append(
          el("div", { class: "schema-media-type" }, el("code", { text: contentType })),
          media?.schema
            ? schemaNode("response", media.schema, true)
            : el("p", { class: "schema-detail", text: "No schema." }),
        );
    }
    root.append(card);
  }
  return root;
}
