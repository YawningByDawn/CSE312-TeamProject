FROM postgres:18

# Copied in rather than bind-mounted, so the host's file permissions can't stop it from running.
COPY --chmod=755 init.sh /docker-entrypoint-initdb.d/init.sh
