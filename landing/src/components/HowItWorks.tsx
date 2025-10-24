export const HowItWorks = () => (
  <section
    id="how-it-works"
    className="mt-20 max-w-5xl mx-auto text-center px-6"
  >
    <h2 className="text-3xl font-semibold mb-8">How It Works</h2>

    <div className="grid md:grid-cols-3 gap-8 text-gray-700">
      <div>
        <h3 className="text-xl font-bold mb-2">1️⃣ Record</h3>
        <p>Click the 🎥 button inside a GitHub PR comment box.</p>
      </div>
      <div>
        <h3 className="text-xl font-bold mb-2">2️⃣ Explain</h3>
        <p>Talk, draw, and highlight your code visually — skip the text wall.</p>
      </div>
      <div>
        <h3 className="text-xl font-bold mb-2">3️⃣ Share</h3>
        <p>Post instantly. Teammates watch the video directly in the PR thread.</p>
      </div>
    </div>
  </section>
);
