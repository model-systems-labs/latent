import Link from "next/link";
import {
  createLearningSuiteHeaderNavigation,
  learningSuite,
} from "@/examples/learning-platform/learning-suite.mjs";

type LearnerDestination =
  | "courses"
  | "practice"
  | "cards"
  | "project"
  | "reading";

type LearnerExperience = "llm-systems";
type LearningSuiteExperience = Readonly<{ id: string; navLabel: string }>;

const destinations = [
  { id: "courses", href: "/course", label: "Courses" },
  { id: "practice", href: "/practice", label: "Practice" },
  { id: "cards", href: "/flashcards", label: "Review" },
  { id: "reading", href: "/sources", label: "Reading" },
] as const;

const learningSuiteBasePath = process.env.LATENT_LEARNING_SUITE_BASE_PATH ?? "";
const suiteDestinations = createLearningSuiteHeaderNavigation({
  rootHref: `${learningSuiteBasePath}/`,
  currentId: "llm-systems",
});
const llmSystemsExperience = learningSuite.experiences.find(
  (experience: LearningSuiteExperience) => experience.id === "llm-systems",
)!;

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
  const productName = suiteMode ? llmSystemsExperience.navLabel : "Latent Courses";
  const navigation = suiteMode ? suiteNavigation : destinations;
  return (
    <header
      className={`learner-header${className ? ` ${className}` : ""}`}
      data-learner-family-header={suiteMode ? "true" : undefined}
    >
      <div className="learner-header__inner">
        <div className="learner-header__identity">
          <Link
            className="learner-wordmark"
            href={suiteMode ? "/courses/llm-systems" : "/"}
            aria-label={`${productName} home`}
          >
            <i className="learner-wordmark__mark" aria-hidden="true" />
            <span>{productName}</span>
          </Link>
          {suiteMode ? <span className="learner-header__meta">Build the system</span> : null}
        </div>
        <PrimaryNavigation current={current} items={navigation} />
        <details
          className={`learner-nav-menu${suiteMode ? "" : " learner-nav-menu--local-only"}`}
        >
          <summary>{suiteMode ? "Learning suite" : "Menu"}</summary>
          <div className="learner-nav-menu__panel">
            {suiteMode ? (
              <nav className="learner-global-nav" aria-label={learningSuite.navigationLabel}>
                {suiteDestinations.map((destination) => (
                  <a
                    aria-current={destination.current ? "page" : undefined}
                    href={destination.href}
                    key={destination.href}
                  >
                    {destination.label}
                  </a>
                ))}
              </nav>
            ) : null}
            <PrimaryNavigation current={current} items={navigation} mobile />
          </div>
        </details>
      </div>
    </header>
  );
}
