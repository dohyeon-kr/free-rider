cask "free-rider" do
  arch arm: "arm64", intel: "x64"

  version "0.23.2"
  sha256 arm:   "ed7899fb7d26e1087ef54ab9ec15ec3fa55de601b0bfa81e9303c23c498c310e",
         intel: "341f56b03a303ebb151a74758ff4b81f578f31d5e0220542c1b7de9b952e57c4"

  url "https://github.com/dohyeon-kr/free-rider/releases/download/v#{version}/Free-Rider-#{version}-mac-#{arch}.dmg",
      verified: "github.com/dohyeon-kr/free-rider/"
  name "Free Rider"
  desc "All-free, open-source, local-first API client"
  homepage "https://dohyeon-kr.github.io/free-rider/"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "Free Rider.app"
end
