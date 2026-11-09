/** Save only the ticket cards (not the page) as a PDF file, one ticket per page. Browser-only. */
export async function downloadTickets(nodes: HTMLElement[], filename: string) {
  const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  let pdf: InstanceType<typeof jsPDF> | null = null;
  for (const node of nodes) {
    const w = node.offsetWidth, h = node.offsetHeight;
    const png = await toPng(node, { pixelRatio: 2, cacheBust: true });
    const orientation = w >= h ? "landscape" : "portrait";
    if (!pdf) pdf = new jsPDF({ orientation, unit: "px", format: [w, h], hotfixes: ["px_scaling"] });
    else pdf.addPage([w, h], orientation);
    pdf.addImage(png, "PNG", 0, 0, w, h);
  }
  pdf?.save(filename);
}
