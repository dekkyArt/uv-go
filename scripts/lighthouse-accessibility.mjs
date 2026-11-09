import Accessibility from 'lighthouse/core/gather/gatherers/accessibility.js';

/** Apply the same footer contrast exception as e2e/a11y.spec.ts, keeping all other audits. */
export default class SiteAccessibility extends Accessibility {
  async getArtifact(context) {
    const artifact = await super.getArtifact(context);
    const contrast = artifact.violations.find((rule) => rule.id === 'color-contrast');
    if (!contrast) return artifact;

    const exempt = await context.driver.executionContext.evaluate(
      (selectors) => {
        const footer = document.querySelector('[data-page] > footer');
        return selectors.map((selector) => {
          try {
            const matches = [...document.querySelectorAll(selector)];
            // Unresolved or ambiguous selectors must never hide a failure outside the footer.
            return matches.length > 0 && matches.every((node) => footer?.contains(node));
          } catch {
            // Lighthouse's diagnostic selectors can contain unescaped utility classes.
            return false;
          }
        });
      },
      { args: [contrast.nodes.map((node) => node.node.selector)], useIsolation: true },
    );
    const nodes = contrast.nodes.filter((_, index) => !exempt[index]);
    return {
      ...artifact,
      violations: artifact.violations.flatMap((rule) =>
        rule !== contrast ? [rule] : nodes.length ? [{ ...rule, nodes }] : [],
      ),
    };
  }
}
