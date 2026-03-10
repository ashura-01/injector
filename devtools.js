browser.devtools.panels.create(
    "Injector",
    "",
    "panel.html"
).then(() => {
    console.log("Panel created successfully!");
}).catch((err) => {
    console.error("Error creating panel:", err);
});
