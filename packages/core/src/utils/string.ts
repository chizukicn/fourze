export function transformTemplate(
  template: string,
  options: Record<string, any>
) {
  return template.replace(/<%= (.+?) %>/g, (_, name) => {
    return options[name] ?? "";
  });
}
