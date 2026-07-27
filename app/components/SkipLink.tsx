const mainContentId = "main-content";

export function SkipLink() {
  return (
    <a className="site-skip-link" href={`#${mainContentId}`}>
      Skip to learning content
    </a>
  );
}
