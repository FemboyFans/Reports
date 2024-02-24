FROM ruby:3.2.2-alpine3.19 as ruby-builder

RUN apk --no-cache add build-base cmake git glib-dev postgresql15-dev

COPY Gemfile Gemfile.lock ./
RUN gem i foreman && BUNDLE_IGNORE_CONFIG=true bundle install -j$(nproc) \
 && rm -rf /usr/local/bundle/cache/*.gem \
 && find /usr/local/bundle/gems/ -name "*.c" -delete \
 && find /usr/local/bundle/gems/ -name "*.o" -delete


FROM ruby:3.2.2-alpine3.19

RUN apk --no-cache add ffmpeg vips \
  postgresql15-client \
  git jemalloc tzdata \
  sudo

WORKDIR /app

ENV LD_PRELOAD=/usr/lib/libjemalloc.so.2
ENV RUBY_YJIT_ENABLE=1

COPY . .
COPY --from=ruby-builder /usr/local/bundle /usr/local/bundle

# Create a user with (potentially) the same id as on the host
ARG HOST_UID=1000
ARG HOST_GID=1000
RUN addgroup --gid ${HOST_GID} pawsmovin && \
  adduser -S --shell /bin/sh --uid ${HOST_UID} pawsmovin && \
  addgroup pawsmovin wheel && \
  echo "pawsmovin ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Ignore warnings from git about .git permission differences when running as root
RUN git config --global --add safe.directory $(pwd)

EXPOSE 3000

CMD ["foreman", "start"]
