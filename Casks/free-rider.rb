cask "free-rider" do
  arch arm: "arm64", intel: "x64"

  version "0.24.1"
  sha256 arm:   "d142e5ce75306d3f5b75c5df8f425f70464331bac01dbba980146a5073995a5b",
         intel: "d97f04acc09a750ace8ede83c62e3c2cf5790f06a43372383bf562cdd585d63e"

  url "https://github.com/dohyeon-kr/free-rider/releases/download/v#{version}/Free-Rider-#{version}-mac-#{arch}.dmg",
      verified: "github.com/dohyeon-kr/free-rider/"
  name "Free Rider"
  desc "All-free, open-source, local-first API client"
  homepage "https://dohyeon-kr.github.io/free-rider/"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "Free Rider.app"
end
