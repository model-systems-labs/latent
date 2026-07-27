const mainContentId = "main-content";

export function SkipLink() {
  return (
    <a className="learner-skip-link site-skip-link" href={`#${mainContentId}`}>
      Skip to learning content
    </a>
  );
}
