import React, { useState } from 'react';

const LandingPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would send to your backend
    console.log('Waitlist signup:', email);
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🎥</span>
              <span className="text-xl font-bold text-gray-900">PullTalk</span>
            </div>
            <nav className="hidden md:flex space-x-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900">Features</a>
              <a href="#how-it-works" className="text-gray-600 hover:text-gray-900">How It Works</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900">Pricing</a>
            </nav>
            <button className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700">
              Join Waitlist
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-green-50 to-blue-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Clarify code reviews in 60 seconds
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            PullTalk brings voice, video, and visual context directly to your pull requests, 
            ending confusing text threads and saving everyone from unnecessary meetings.
          </p>
          <div className="flex justify-center space-x-4">
            <button className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700">
              Add to GitHub (Coming Soon)
            </button>
            <button className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:bg-gray-50">
              Watch Demo
            </button>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Stop writing paragraphs. Start building understanding.
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              A paragraph of text in a PR comment can't convey tone, visual flow, or architectural nuance. 
              The result? Misunderstandings, delays, and "Let's hop on a quick call."
            </p>
          </div>
          
          <div className="bg-gray-900 rounded-xl p-8 max-w-4xl mx-auto">
            <div className="bg-gray-800 rounded-lg p-4 mb-4 flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div className="text-gray-400 text-sm ml-4">github.com/your-org/your-repo/pull/123</div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <div className="flex space-x-2">
                  <button className="bg-green-600 text-white px-3 py-1 rounded text-sm">Write</button>
                  <button className="text-gray-400 px-3 py-1 rounded text-sm">Preview</button>
                </div>
                <button className="bg-green-600 text-white px-4 py-2 rounded text-sm flex items-center space-x-2">
                  <span>🎥</span>
                  <span>Add Video Comment</span>
                </button>
              </div>
              
              <div className="bg-gray-700 rounded p-4 min-h-[200px] flex items-center justify-center text-gray-400">
                GitHub comment box with PullTalk integration
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Engineer-to-engineer communication, reimagined
            </h2>
            <p className="text-lg text-gray-600">
              PullTalk makes code review fast, clear, and async-first.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: '🎯',
                title: '5x Faster Reviews',
                description: 'Explain complex feedback with voice and drawings in under a minute.'
              },
              {
                icon: '💬',
                title: 'Crystal-Clear Context',
                description: 'Get the "why" behind code decisions with visual explanations.'
              },
              {
                icon: '🚀',
                title: 'Zero Workflow Disruption',
                description: 'Works directly in GitHub. No new platforms to learn.'
              },
              {
                icon: '📚',
                title: 'Knowledge Preservation',
                description: 'Create a searchable archive of technical decisions.'
              }
            ].map((feature, index) => (
              <div key={index} className="bg-white p-6 rounded-lg shadow-sm">
                <div className="text-2xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">How PullTalk Works</h2>
            <p className="text-lg text-gray-600">Get started in just 30 seconds</p>
          </div>
          
          <div className="flex flex-col md:flex-row justify-between items-center max-w-4xl mx-auto">
            {[
              { step: '1', title: 'Install', description: 'Add from GitHub Marketplace' },
              { step: '2', title: 'Click Record', description: 'Open any PR comment box' },
              { step: '3', title: 'Explain', description: 'Talk, draw, and highlight code' },
              { step: '4', title: 'Post', description: 'Video embeds natively in PR' }
            ].map((item, index) => (
              <div key={index} className="text-center mb-8 md:mb-0 flex-1">
                <div className="w-16 h-16 bg-green-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Waitlist CTA */}
      <section className="py-20 bg-green-600">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to transform your code reviews?
          </h2>
          <p className="text-green-100 mb-8 text-lg">
            Join the waitlist and be the first to try PullTalk.
          </p>
          
          {submitted ? (
            <div className="bg-green-500 text-white p-4 rounded-lg inline-block">
              🎉 Thanks for joining! We'll be in touch soon.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 justify-center">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="px-4 py-3 rounded-lg flex-grow max-w-md"
                required
              />
              <button
                type="submit"
                className="bg-white text-green-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100"
              >
                Join Waitlist
              </button>
            </form>
          )}
          
          <p className="text-green-200 text-sm mt-4">
            We're currently in private beta. No spam, ever.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-