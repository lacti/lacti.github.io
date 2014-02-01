---
layout: post
title: debian 계열 db 덮어쓸 때 주의점
tags: database -pub
---

debian-sys-maint 계정 암호가 바뀌면 안된다

이 암호는 `/etc/mysql/debian.cnf`에서 볼 수 있으니 여기서 암호를 찾아서,

```sql
GRANT ALL PRIVILEGES ON *.* TO 'debian-sys-maint'@'localhost' IDENTIFIED BY 'YOUR-PASSWORD' WITH GRANT OPTION
GRANT RELOAD, SHUTDOWN, PROCESS, SHOW DATABASES, SUPER, LOCK TABLES ON *.* TO 'debian-sys-maint'@'localhost' IDENTIFIED BY 'YOUR-PASSWORD'
```

한번 해줘서 계정 암호 갱신하면 된다.