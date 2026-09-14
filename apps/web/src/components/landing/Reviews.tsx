import { Star } from "@phosphor-icons/react/dist/ssr";
import { BeforeAfterSlider } from "@/components/generation/BeforeAfterSlider";

const REVIEWS = [
  {
    beforeUrl: "/reviews/review_1.png",
    afterUrl: "/reviews/review-redesign-1.png",
    name: "Marta K.",
    location: "Warsaw, Poland",
    tag: "Kitchen · Scandinavian",
    rating: 5,
    quote:
      "Our kitchen was literally just bare concrete and a stud wall and thanks God I found this app after a designer asked 300€ just for a kitchen visualisation, which is mad. Uploaded a photo and boom - an actual layout I could show the contractor instead of just waving my hands around.",
  },
  {
    beforeUrl: "/reviews/review_3.png",
    afterUrl: "/reviews/review-redesign-3.png",
    name: "Susan P.",
    location: "Albany, USA",
    tag: "Living Room · Farmhouse",
    rating: 5,
    quote:
      "I flip houses for a living so I run basically every listing through this before we touch a wall. This one was SO 90s florals it hurt lol. Now I can show buyers (and my crew) the end result before we've spent a dollar on paint.",
  },
  {
    beforeUrl: "/reviews/review_2.png",
    afterUrl: "/reviews/review-redesign-2.png",
    name: "Emre Y.",
    location: "Cappadocia, Turkey",
    tag: "Bedroom · Eclectic",
    rating: 5,
    quote:
      "Turning my inherited great-grandmother's house into an Airbnb on a tight budget. This app helped to make it really cool. Thanks!",
  },
  {
    beforeUrl: "/reviews/review_4.png",
    afterUrl: "/reviews/review-redesign-4.png",
    name: "James R.",
    location: "Portland, USA",
    tag: "Kitchen · Modern",
    rating: 4,
    quote:
      "Was so on the fence about a full kitchen remodel. Uploaded a pic of our sad old cabinets and got a clear picture of the end result. A bit expensive, but that's probably because I still have a ton of actual renovation to pay for :)",
  },
];

export function Reviews() {
  return (
    <section
      id="reviews"
      className="border-y border-white/30 bg-muted/50 px-6 py-24 backdrop-blur-md sm:px-8 sm:py-28"
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
            Real rooms, redesigned
          </h2>
          <p className="mt-4 text-muted-foreground">
            Drag the slider on each result to see what changed — and what stayed
            exactly the same.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {REVIEWS.map((review) => (
            <div
              key={review.name}
              className="flex flex-col overflow-hidden rounded-2xl border border-white/40 bg-card/40 shadow-lg shadow-black/5 backdrop-blur-xl"
            >
              <BeforeAfterSlider
                beforeUrl={review.beforeUrl}
                afterUrl={review.afterUrl}
                beforeAlt={`${review.name}'s room before AI redesign`}
                afterAlt={`${review.name}'s room after AI redesign, ${review.tag}`}
                className="rounded-none!"
              />
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-center gap-0.5" aria-hidden>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={16}
                      weight="fill"
                      className={
                        i < review.rating
                          ? "text-accent"
                          : "text-muted-foreground/30"
                      }
                    />
                  ))}
                </div>
                <p className="mt-3 text-sm text-foreground">
                  &ldquo;{review.quote}&rdquo;
                </p>
                <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                  <p className="text-sm font-semibold">
                    {review.name}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {review.location}
                    </span>
                  </p>
                  <span className="shrink-0 rounded-full border border-white/40 bg-accent-soft/60 px-3 py-1 text-xs font-medium text-accent-hover">
                    {review.tag}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
