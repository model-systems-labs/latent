import Link from "next/link";
import {
  createLearningSuiteHeaderConfiguration,
} from "@/examples/learning-platform/learning-suite.mjs";

type LearnerDestination =
  | "courses"
  | "practice"
  | "cards"
  | "project"
  | "reading";

type LearnerExperience = "llm-systems";
type LearningSuiteHeaderContract = Readonly<{
  productName: string;
  homeHref: string;
  homeLabel: string;
  navigationLabel: string;
  navigation: readonly Readonly<{
    label: string;
    href: string;
    current?: boolean;
  }>[];
  menuLabel: string;
  meta: string;
}>;

const destinations = [
  { id: "courses", href: "/course", label: "Courses" },
  { id: "practice", href: "/practice", label: "Practice" },
  { id: "cards", href: "/flashcards", label: "Review" },
  { id: "reading", href: "/sources", label: "Reading" },
] as const;

const learningSuiteBasePath = process.env.LATENT_LEARNING_SUITE_BASE_PATH ?? "";
const suiteHeader = createLearningSuiteHeaderConfiguration({
  rootHref: `${learningSuiteBasePath}/`,
  currentId: "llm-systems",
}) as LearningSuiteHeaderContract;

const suiteNavigation = [
  { id: "courses", href: "/courses/llm-systems", label: "Modules" },
  { id: "practice", href: "/workspace", label: "Practice" },
  { id: "cards", href: "/flashcards", label: "Review" },
  { id: "project", href: "/project", label: "Project" },
  { id: "reading", href: "/sources", label: "Reading" },
] as const;

function PrimaryNavigation({
  current,
  items,
  mobile = false,
}: {
  current?: LearnerDestination;
  items: typeof destinations | typeof suiteNavigation;
  mobile?: boolean;
}) {
  return (
    <nav
      className={`learner-primary-nav learner-primary-nav--${mobile ? "mobile" : "desktop"}`}
      aria-label="Learning navigation"
    >
      {items.map((destination) => (
        <Link
          aria-current={current === destination.id ? "page" : undefined}
          href={destination.href}
          key={destination.id}
        >
          {destination.label}
        </Link>
      ))}
    </nav>
  );
}

function LearningSuiteNavigation({ mobile = false }: { mobile?: boolean }) {
  return (
    <nav
      className={`learner-primary-nav learner-primary-nav--${mobile ? "mobile" : "desktop"}`}
      aria-label={suiteHeader.navigationLabel}
    >
      {suiteHeader.navigation.map((destination) => (
        <a
          aria-current={destination.current ? "page" : undefined}
          href={destination.href}
          key={destination.href}
        >
          {destination.label}
        </a>
      ))}
    </nav>
  );
}

function LlmSystemsContextNavigation({
  current,
}: {
  current?: LearnerDestination;
}) {
  return (
    <nav className="learner-context-nav" aria-label="LLM Systems navigation">
      <div className="learner-context-nav__inner">
        {suiteNavigation.map((destination) => (
          <Link
            aria-current={current === destination.id ? "page" : undefined}
            href={destination.href}
            key={destination.id}
          >
            {destination.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function LearnerHeader({
  className,
  current,
  experience,
}: {
  className?: string;
  current?: LearnerDestination;
  experience?: LearnerExperience;
}) {
  const suiteMode = experience === "llm-systems"
    || process.env.LATENT_COURSE_HOME === "llm-systems";
  const productName = suiteMode ? suiteHeader.productName : "Latent Courses";
  const wordmarkContent = (
    <>
      <i className="learner-wordmark__mark" aria-hidden="true" />
      <span>{productName}</span>
    </>
  );
  return (
    <>
      <header
        className={`learner-header${className ? ` ${className}` : ""}`}
        data-learner-family-header={suiteMode ? "true" : undefined}
      >
        <div className="learner-header__inner">
          <div className="learner-header__identity">
            {suiteMode ? (
              <a
                className="learner-wordmark"
                href={suiteHeader.homeHref}
                aria-label={suiteHeader.homeLabel}
              >
                {wordmarkContent}
              </a>
            ) : (
              <Link
                className="learner-wordmark"
                href="/"
                aria-label={`${productName} home`}
              >
                {wordmarkContent}
              </Link>
            )}
            {suiteMode ? (
              <span className="learner-header__meta">{suiteHeader.meta}</span>
            ) : null}
          </div>
          {suiteMode ? (
            <LearningSuiteNavigation />
          ) : (
            <PrimaryNavigation current={current} items={destinations} />
          )}
          <details className="learner-nav-menu learner-nav-menu--local-only">
            <summary>{suiteMode ? suiteHeader.menuLabel : "Menu"}</summary>
            <div className="learner-nav-menu__panel">
              {suiteMode ? (
                <LearningSuiteNavigation mobile />
              ) : (
                <PrimaryNavigation current={current} items={destinations} mobile />
              )}
            </div>
          </details>
        </div>
      </header>
      {suiteMode ? <LlmSystemsContextNavigation current={current} /> : null}
    </>
  );
}
