import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const MAX_IMAGES = 4;

function buildViewUrl(entry) {
    const params = new URLSearchParams({
        filename: entry.name,
        subfolder: entry.subfolder || "",
        type: entry.type || "input",
        rand: (entry.rand ?? Date.now()).toString(),
    });
    return `/view?${params.toString()}`;
}

async function uploadImage(file) {
    const fd = new FormData();
    fd.append("image", file);
    fd.append("overwrite", "false");
    const resp = await api.fetchApi("/upload/image", { method: "POST", body: fd });
    if (resp.status !== 200) {
        throw new Error(`Upload failed with status ${resp.status}`);
    }
    const data = await resp.json();
    return {
        name: data.name,
        subfolder: data.subfolder || "",
        type: data.type || "input",
        rand: Date.now(),
    };
}

app.registerExtension({
    name: "KleinRefGrid.Gallery",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "FluxKleinRefGrid") return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const ret = onNodeCreated?.apply(this, arguments);

            const stateWidget = this.widgets?.find((w) => w.name === "image_list");
            if (!stateWidget) return ret;

            // Parse persisted state
            let images = [];
            try {
                const parsed = JSON.parse(stateWidget.value || "[]");
                if (Array.isArray(parsed)) images = parsed;
            } catch (_) {
                images = [];
            }

            // Hide the raw string widget but keep it serialised
            stateWidget.type = "klein-hidden";
            stateWidget.computeSize = () => [0, -4];
            stateWidget.draw = () => {};
            stateWidget.hidden = true;

            // --- DOM ------------------------------------------------------
            const container = document.createElement("div");
            container.className = "klein-refgrid-root";
            container.style.cssText =
                "display:flex;flex-direction:column;gap:6px;padding:6px;box-sizing:border-box;width:100%;font-family:sans-serif;";

            const gallery = document.createElement("div");
            gallery.className = "klein-refgrid-gallery";
            gallery.style.cssText =
                "display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:3px;aspect-ratio:1/1;background:#181818;border:1px solid #333;border-radius:4px;overflow:hidden;";

            const controls = document.createElement("div");
            controls.style.cssText = "display:flex;gap:6px;align-items:center;";

            const addBtn = document.createElement("button");
            addBtn.type = "button";
            addBtn.textContent = "Add Images";
            addBtn.style.cssText =
                "flex:1;padding:6px 10px;background:#353535;color:#eee;border:1px solid #555;border-radius:4px;cursor:pointer;font-size:12px;";
            addBtn.onmouseenter = () => (addBtn.style.background = "#454545");
            addBtn.onmouseleave = () => (addBtn.style.background = "#353535");

            const clearBtn = document.createElement("button");
            clearBtn.type = "button";
            clearBtn.textContent = "Clear";
            clearBtn.title = "Remove all images";
            clearBtn.style.cssText =
                "padding:6px 10px;background:#3a2a2a;color:#eee;border:1px solid #663333;border-radius:4px;cursor:pointer;font-size:12px;";

            controls.appendChild(addBtn);
            controls.appendChild(clearBtn);

            const status = document.createElement("div");
            status.style.cssText =
                "font-size:10px;color:#888;text-align:center;min-height:12px;";

            const fileInput = document.createElement("input");
            fileInput.type = "file";
            fileInput.accept = "image/*";
            fileInput.multiple = true;
            fileInput.style.display = "none";

            container.appendChild(gallery);
            container.appendChild(controls);
            container.appendChild(status);
            container.appendChild(fileInput);

            // --- state sync -----------------------------------------------
            const save = () => {
                stateWidget.value = JSON.stringify(images);
            };

            const render = () => {
                gallery.replaceChildren();
                for (let i = 0; i < MAX_IMAGES; i++) {
                    const cell = document.createElement("div");
                    cell.style.cssText =
                        "position:relative;background:#0e0e0e;display:flex;align-items:center;justify-content:center;overflow:hidden;min-height:0;min-width:0;";

                    if (i < images.length) {
                        const img = document.createElement("img");
                        img.src = buildViewUrl(images[i]);
                        img.draggable = false;
                        img.style.cssText =
                            "width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;";
                        img.onerror = () => {
                            img.remove();
                            const missing = document.createElement("span");
                            missing.textContent = "missing";
                            missing.style.cssText = "color:#a55;font-size:10px;";
                            cell.prepend(missing);
                        };
                        cell.appendChild(img);

                        const removeBtn = document.createElement("button");
                        removeBtn.type = "button";
                        removeBtn.textContent = "\u00d7";
                        removeBtn.title = "Remove image";
                        removeBtn.style.cssText =
                            "position:absolute;top:3px;right:3px;width:20px;height:20px;padding:0;border:none;background:rgba(0,0,0,0.75);color:#fff;border-radius:50%;cursor:pointer;font-size:16px;line-height:1;display:flex;align-items:center;justify-content:center;";
                        removeBtn.onmouseenter = () =>
                            (removeBtn.style.background = "rgba(180,40,40,0.9)");
                        removeBtn.onmouseleave = () =>
                            (removeBtn.style.background = "rgba(0,0,0,0.75)");
                        removeBtn.onclick = (e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            images.splice(i, 1);
                            save();
                            render();
                        };
                        cell.appendChild(removeBtn);

                        const label = document.createElement("div");
                        label.textContent = String(i + 1);
                        label.style.cssText =
                            "position:absolute;bottom:3px;left:3px;padding:1px 6px;background:rgba(0,0,0,0.7);color:#fff;border-radius:3px;font-size:10px;";
                        cell.appendChild(label);
                    } else {
                        const ph = document.createElement("span");
                        ph.textContent = `slot ${i + 1}`;
                        ph.style.cssText = "color:#444;font-size:10px;";
                        cell.appendChild(ph);
                    }
                    gallery.appendChild(cell);
                }

                status.textContent =
                    images.length === 0
                        ? "No images \u2014 click Add Images"
                        : `${images.length} / ${MAX_IMAGES} images`;

                clearBtn.disabled = images.length === 0;
                clearBtn.style.opacity = images.length === 0 ? "0.5" : "1";
                addBtn.disabled = images.length >= MAX_IMAGES;
                addBtn.style.opacity = images.length >= MAX_IMAGES ? "0.5" : "1";
            };

            // --- interactions ---------------------------------------------
            addBtn.onclick = () => {
                if (images.length >= MAX_IMAGES) return;
                fileInput.click();
            };

            clearBtn.onclick = () => {
                if (images.length === 0) return;
                images.length = 0;
                save();
                render();
            };

            fileInput.onchange = async () => {
                const files = Array.from(fileInput.files || []);
                fileInput.value = "";
                if (files.length === 0) return;

                status.textContent = "Uploading\u2026";
                for (const file of files) {
                    if (images.length >= MAX_IMAGES) break;
                    try {
                        const entry = await uploadImage(file);
                        images.push(entry);
                        save();
                        render();
                    } catch (err) {
                        console.error("[KleinRefGrid] upload failed:", err);
                        status.textContent = `Upload failed: ${err.message}`;
                    }
                }
            };

            // --- mount as DOM widget --------------------------------------
            const galleryWidget = this.addDOMWidget(
                "klein_gallery",
                "gallery",
                container,
                {
                    serialize: false,
                    hideOnZoom: false,
                }
            );

            galleryWidget.computeSize = function (width) {
                const w = Math.max(width || 260, 200);
                return [w, w + 70];
            };

            render();

            // Re-render on configure (workflow load)
            const onConfigure = this.onConfigure;
            this.onConfigure = function (info) {
                const r = onConfigure?.apply(this, arguments);
                try {
                    const parsed = JSON.parse(stateWidget.value || "[]");
                    images.length = 0;
                    if (Array.isArray(parsed)) {
                        for (const p of parsed) images.push(p);
                    }
                } catch (_) {
                    images.length = 0;
                }
                render();
                return r;
            };

            requestAnimationFrame(() => {
                const current = this.size || [0, 0];
                const min = [320, 480];
                this.setSize([
                    Math.max(current[0], min[0]),
                    Math.max(current[1], min[1]),
                ]);
                app.graph.setDirtyCanvas(true, true);
            });

            return ret;
        };
    },
});
