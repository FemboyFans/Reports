require_relative "boot"

require "rails/all"
# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

require_relative "default_config"

module Reports
  class Application < Rails::Application
    config.load_defaults 7.1

    config.autoload_lib(ignore: %w[assets tasks])

    config.api_only = true
    config.action_controller.action_on_unpermitted_parameters = :raise
    config.time_zone = "Central Time (US & Canada)"
    config.generators.assets = false
    config.generators.helper = false
    config.generators.test_framework = nil
  end
end
