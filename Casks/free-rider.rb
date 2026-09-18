cask "free-rider" do
  arch arm: "arm64", intel: "x64"

  version "0.20.0"
  sha256 arm:   "dec866223a4926b0b485bcb48efd91ed86e33c383e78b4b0688eb7c471305cb8",
         intel: "e9671e2b067285029965ed7321e740eecdcfb26a6254c5c9457eb84a450e9e02"

  url "https://github.com/dohyeon-kr/free-rider/releases/download/v#{version}/Free-Rider-#{version}-mac-#{arch}.dmg",
      verified: "github.com/dohyeon-kr/free-rider/"
  name "Free Rider"
  desc "All-free, open-source, local-first API client"
  homepage "https://dohyeon-kr.github.io/free-rider/"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "Free Rider.app"
end
