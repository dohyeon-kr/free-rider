cask "free-rider" do
  arch arm: "arm64", intel: "x64"

  version "0.15.0"
  sha256 arm:   "5d1e22555cf4eaba432594ef98023d74bf50f782fd0d696d9819e0338de18d2c",
         intel: "349fb7a53088ff1ab16c699d84f6271b35f99fbd536330f71b649c73f7c11647"

  url "https://github.com/dohyeon-kr/free-rider/releases/download/v#{version}/Free-Rider-#{version}-mac-#{arch}.dmg",
      verified: "github.com/dohyeon-kr/free-rider/"
  name "Free Rider"
  desc "All-free, open-source, local-first API client"
  homepage "https://dohyeon-kr.github.io/free-rider/"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "Free Rider.app"
end
