import Link from "next/link";
import { Sparkles, Clock, Shield, Smartphone, Truck, Package, Calendar, CreditCard, CheckCircle } from "lucide-react";

export default function Home() {
  return (
    <>
      {/* Hero Section */}
      <main className="container mx-auto px-6 py-20 -mt-8">
        <div className="text-center max-w-5xl mx-auto">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-teal-100 to-emerald-100 text-teal-700 text-sm font-medium mb-6 border border-teal-200">
            <Sparkles className="w-4 h-4 mr-2" />
            Professional Laundry Service
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 mb-6 leading-tight">
            Fresh Laundry.
            <br />
            <span className="bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
              Fresh Start.
            </span>
          </h1>
          
          <p className="text-xl text-slate-600 mb-10 max-w-3xl mx-auto leading-relaxed">
            Fresh Service — that's our promise. Premium pickup and delivery laundry service 
            with flexible subscription plans designed for your lifestyle.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Link 
              href="/auth/signup"
              className="group bg-gradient-to-r from-teal-500 to-emerald-500 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-teal-600 hover:to-emerald-600 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              Start Your Service
              <span className="ml-2 group-hover:translate-x-1 transition-transform inline-block">→</span>
            </Link>
            <Link 
              href="#how-it-works"
              className="border-2 border-slate-300 text-slate-700 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-slate-50 hover:border-slate-400 transition-all"
            >
              How It Works
            </Link>
          </div>

          {/* Driver CTA */}
          <div className="mb-12">
            <Link 
              href="/dashboard/apply-driver"
              className="inline-flex items-center text-teal-600 hover:text-teal-700 font-medium text-lg transition-colors"
            >
              Want to drive with us? 
              <span className="ml-2 hover:translate-x-1 transition-transform inline-block">Apply now →</span>
            </Link>
          </div>

          {/* Trust Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl mx-auto">
            <div className="flex items-center justify-center space-x-2 text-slate-600">
              <Clock className="w-5 h-5 text-teal-500" />
              <span className="text-sm font-medium">24-48 Hour Turnaround</span>
            </div>
            <div className="flex items-center justify-center space-x-2 text-slate-600">
              <Shield className="w-5 h-5 text-emerald-500" />
              <span className="text-sm font-medium">Eco-Friendly Process</span>
            </div>
            <div className="flex items-center justify-center space-x-2 text-slate-600">
              <Sparkles className="w-5 h-5 text-teal-500" />
              <span className="text-sm font-medium">Premium Care</span>
            </div>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section id="how-it-works" className="bg-white py-20">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              How Tumble Works
            </h2>
            <p className="text-lg text-slate-600">
              Simple, convenient, and reliable laundry service in three easy steps
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="text-center group">
              <div className="w-20 h-20 bg-gradient-to-br from-teal-400 to-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:shadow-xl transition-shadow">
                <Smartphone className="text-white w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Schedule Pickup</h3>
              <p className="text-slate-600 leading-relaxed">
                Choose your subscription plan and schedule your first pickup in minutes through our easy-to-use platform.
              </p>
            </div>
            
            <div className="text-center group">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:shadow-xl transition-shadow">
                <Package className="text-white w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">We Handle It</h3>
              <p className="text-slate-600 leading-relaxed">
                Professional wash, dry, and fold service with eco-friendly detergents. Special care options available.
              </p>
            </div>
            
            <div className="text-center group">
              <div className="w-20 h-20 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:shadow-xl transition-shadow">
                <Truck className="text-white w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Fresh Delivery</h3>
              <p className="text-slate-600 leading-relaxed">
                Clean, neatly folded clothes delivered back to your door on schedule, ready to wear.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="bg-gradient-to-br from-slate-50 to-teal-50 py-20">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              Fresh Laundry Plans
            </h2>
            <p className="text-lg text-slate-600">
              Choose the perfect plan for your laundry needs. Fresh Start for singles, Family Fresh for families.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Fresh Start Plan */}
            <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow border border-slate-200">
              <div className="text-center">
                <div className="flex items-center justify-center mb-4">
                  <span className="text-2xl mr-2">🌱</span>
                  <h3 className="text-xl font-bold text-slate-800">Fresh Start</h3>
                </div>
                <p className="text-slate-600 text-sm mb-4">Perfect for singles and students</p>
                <div className="text-3xl font-bold text-slate-900 mb-6">
                  $48
                  <span className="text-lg text-slate-500 font-normal">/month</span>
                </div>
                <ul className="space-y-2 text-slate-600 mb-6 text-sm">
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-teal-500 mr-2 flex-shrink-0" />
                    2 Standard Bag pickups per month
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-teal-500 mr-2 flex-shrink-0" />
                    Up to 4 loads total
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-teal-500 mr-2 flex-shrink-0" />
                    Free delivery & pickup
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-teal-500 mr-2 flex-shrink-0" />
                    Priority scheduling
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-teal-500 mr-2 flex-shrink-0" />
                    Extra bags: $30 each
                  </li>
                </ul>
                <Link 
                  href="/auth/signup"
                  className="block w-full bg-gradient-to-r from-slate-600 to-slate-700 text-white text-center py-3 rounded-xl font-semibold hover:from-slate-700 hover:to-slate-800 transition-all transform hover:scale-105"
                >
                  Choose Plan
                </Link>
              </div>
            </div>
            
            {/* Family Fresh Plan */}
            <div className="bg-white rounded-2xl p-6 shadow-xl border-2 border-teal-200 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg">
                  MOST POPULAR
                </span>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-4 mt-2">
                  <span className="text-2xl mr-2">🏡</span>
                  <h3 className="text-xl font-bold text-slate-800">Family Fresh</h3>
                </div>
                <p className="text-slate-600 text-sm mb-4">Great for small families</p>
                <div className="text-3xl font-bold text-slate-900 mb-6">
                  $130
                  <span className="text-lg text-slate-500 font-normal">/month</span>
                </div>
                <ul className="space-y-2 text-slate-600 mb-6 text-sm">
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-emerald-500 mr-2 flex-shrink-0" />
                    6 Standard Bag pickups per month
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-emerald-500 mr-2 flex-shrink-0" />
                    Up to 12 loads total
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-emerald-500 mr-2 flex-shrink-0" />
                    Free delivery & pickup
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-emerald-500 mr-2 flex-shrink-0" />
                    Priority scheduling
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-emerald-500 mr-2 flex-shrink-0" />
                    Extra bags: $30 each
                  </li>
                </ul>
                <Link 
                  href="/auth/signup"
                  className="block w-full bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-center py-3 rounded-xl font-semibold hover:from-teal-600 hover:to-emerald-600 transition-all transform hover:scale-105 shadow-lg"
                >
                  Choose Plan
                </Link>
              </div>
            </div>
            
            {/* House Fresh Plan */}
            <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow border border-slate-200">
              <div className="text-center">
                <div className="flex items-center justify-center mb-4">
                  <span className="text-2xl mr-2">🏠</span>
                  <h3 className="text-xl font-bold text-slate-800">House Fresh</h3>
                </div>
                <p className="text-slate-600 text-sm mb-4">Ideal for large families</p>
                <div className="text-3xl font-bold text-slate-900 mb-6">
                  $240
                  <span className="text-lg text-slate-500 font-normal">/month</span>
                </div>
                <ul className="space-y-2 text-slate-600 mb-6 text-sm">
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-teal-500 mr-2 flex-shrink-0" />
                    12 Standard Bag pickups per month
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-teal-500 mr-2 flex-shrink-0" />
                    Up to 24 loads total
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-teal-500 mr-2 flex-shrink-0" />
                    Free delivery & pickup
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-teal-500 mr-2 flex-shrink-0" />
                    Priority scheduling
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-teal-500 mr-2 flex-shrink-0" />
                    Extra bags: $30 each
                  </li>
                </ul>
                <Link 
                  href="/auth/signup"
                  className="block w-full bg-gradient-to-r from-slate-600 to-slate-700 text-white text-center py-3 rounded-xl font-semibold hover:from-slate-700 hover:to-slate-800 transition-all transform hover:scale-105"
                >
                  Choose Plan
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Driver Section */}
      <section className="bg-gradient-to-r from-teal-500 to-emerald-500 py-16">
        <div className="container mx-auto px-6 text-center">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold text-white mb-4">
              Drive with Tumble
            </h2>
            <p className="text-xl text-white/90 mb-8 leading-relaxed">
              Join our team of professional drivers and earn competitive pay with flexible schedules. 
              Be part of a growing business that values quality service and customer satisfaction.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link 
                href="/dashboard/apply-driver"
                className="group bg-white text-teal-600 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-50 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                Apply to Drive
                <span className="ml-2 group-hover:translate-x-1 transition-transform inline-block">→</span>
              </Link>
              <div className="text-white/80 text-sm">
                Requirements: Valid driver's license, insurance, reliable vehicle
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-emerald-400 rounded-xl flex items-center justify-center shadow-lg">
              <Sparkles className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-2xl tracking-tight">Tumble</span>
          </div>
          <p className="text-slate-400 text-lg mb-6">
            Fresh Laundry. Fresh Start. Fresh Service.
          </p>
          <div className="flex items-center justify-center space-x-6 text-slate-500">
            <span className="flex items-center space-x-2">
              <Shield className="w-4 h-4" />
              <span className="text-sm">Eco-Friendly</span>
            </span>
            <span className="flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Fast Turnaround</span>
            </span>
            <span className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm">Premium Care</span>
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}