module Reports
  class Configuration
    def version
      GitHelper.short_hash
    end

    def domain
      "r.femboy.fan"
    end

    def source_code_url
      "https://github.com/FemboyFans/Reports"
    end

    def report_key
      "abc123"
    end

    def redis_url
      "redis://redis/1"
    end
  end

  class EnvironmentConfiguration
    def configuration
      @configuration ||= Configuration.new
    end

    def env_to_boolean(method, var)
      is_boolean = method.to_s.end_with?("?")
      return true if is_boolean && var.truthy?
      return false if is_boolean && var.falsy?
      var
    end

    def method_missing(method, *)
      var = ENV.fetch("REPORTS_#{method.to_s.upcase.chomp('?')}", nil)

      if var.present?
        env_to_boolean(method, var)
      else
        configuration.send(method, *)
      end
    end
  end

  def config
    @config ||= EnvironmentConfiguration.new
  end

  module_function :config
end
