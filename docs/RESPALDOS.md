# Supabase: mantenerlo activo y respaldos

Supabase en el plan gratuito tiene dos problemas: **pausa el proyecto tras unos 7 días sin uso** y **no deja descargar respaldos**. Dos workflows de GitHub se encargan de eso. Los dos entran a la base igual que el workflow "Base de datos": con el secreto `SUPABASE_DB_PASSWORD`, por el *session pooler* (IPv4).

## Los dos workflows

| Workflow | Archivo | Cuándo corre | Qué hace |
|---|---|---|---|
| **Mantener Supabase activo** | `.github/workflows/keepalive.yml` | Cada 3 días (y a mano) | Hace una consulta real a la base (`select count(*) from public.profiles`) para que el proyecto cuente como usado. Si la base no responde (por ejemplo, porque ya se pausó), falla y GitHub manda un mail. |
| **Respaldo de la base** | `.github/workflows/backup.yml` | Los lunes (y a mano) | Copia los datos de los esquemas `public` (todo lo de la app) y `auth` (las cuentas), los **cifra** con una contraseña y los guarda 30 días como *artifact* de la corrida. En el log no se imprime ningún dato. |

Para correr cualquiera a mano: GitHub → **Actions** → elegir el workflow → **Run workflow**.

### Por qué el respaldo va cifrado

El repositorio es público y cualquier persona con cuenta de GitHub puede descargar los *artifacts* de sus corridas. Por eso el respaldo se cifra (gpg, AES256) antes de subirlo, con la contraseña del secreto `BACKUP_PASSPHRASE`. **Si ese secreto no está, el workflow falla y no sube nada**: nunca se sube sin cifrar.

## Lo que tiene que hacer Francisco (una sola vez)

1. Inventar una contraseña larga (por ejemplo, la que genere un gestor de contraseñas, de 30 caracteres o más).
2. **Guardarla en un lugar seguro** (un gestor de contraseñas). GitHub no la vuelve a mostrar: si se pierde, los respaldos no se pueden abrir.
3. En GitHub → el repositorio → **Settings → Secrets and variables → Actions → New repository secret**: nombre `BACKUP_PASSPHRASE`, valor la contraseña.
4. Correr **Respaldo de la base** a mano una vez y ver que termine bien.
5. Para recibir los mails si algo falla: en **Actions**, entrar a cada uno de los dos workflows, menú **···** → **Disable workflow** y después **Enable workflow**. GitHub le manda los avisos de un workflow programado a quien lo creó o lo reactivó por última vez. Y en GitHub → **Settings → Notifications → Actions**, tener activados los mails.

Si algún día se cambia la contraseña, los respaldos viejos se siguen abriendo con la vieja.

## Ojo: GitHub apaga los workflows programados

En un repositorio público, **GitHub desactiva los workflows programados después de 60 días sin actividad en el repo** (sin commits). Avisa por mail antes. Si pasa, se vuelven a prender en Actions → el workflow → **Enable workflow**. Mientras estén apagados, Supabase se puede pausar y no hay respaldos nuevos.

## Cómo restaurar un respaldo

Lo más simple y seguro es restaurar en un **proyecto de Supabase nuevo** (o uno vacío), antes de que alguien entre a la web.

### 1. Descargar

GitHub → **Actions** → **Respaldo de la base** → la corrida que se quiera → abajo, en **Artifacts**, descargar `supabase-backup-AAAA-MM-DD` (hay que tener sesión en GitHub). Es un zip; adentro está `supabase-backup-AAAA-MM-DD.tar.gz.gpg`.

### 2. Descifrar y abrir

Hace falta `gpg` y `tar` (en Windows vienen con Git Bash; en Mac, `brew install gnupg`). En la carpeta del archivo:

```sh
gpg --output respaldo.tar.gz --decrypt supabase-backup-AAAA-MM-DD.tar.gz.gpg   # pide la contraseña
tar -xzf respaldo.tar.gz
```

Queda una carpeta `supabase-backup-AAAA-MM-DD/` con:

- `data.sql`: los datos de `public` y de `auth` (cuentas e identidades de Google; sin sesiones abiertas ni el registro de auditoría: después de restaurar, todos vuelven a iniciar sesión).
- `prepare.sql`: vacía las tablas de `public` antes de cargar los datos (las migraciones ya insertan los planes y otras filas, que si no quedarían duplicadas).
- `schema.sql`: la estructura de `public` en ese momento. Es solo de referencia: la estructura se crea con las migraciones del repo.
- `LEEME.txt`: fecha, versión de Postgres y commit de `main` del respaldo.

### 3. Crear la estructura

En el proyecto nuevo se aplican las migraciones del repo, del mismo commit que dice `LEEME.txt` (o uno posterior que no haya cambiado tablas):

```sh
supabase db push --db-url "postgresql://postgres.<ref>:<contraseña>@<host-del-pooler>:5432/postgres"
```

`<ref>` es el id del proyecto nuevo y el host del *pooler* está en Supabase → **Connect** → *Session pooler*. Si la contraseña tiene símbolos, va codificada para URL.

### 4. Cargar los datos

```sh
psql "host=<host-del-pooler> port=5432 user=postgres.<ref> dbname=postgres sslmode=require" \
  --single-transaction -v ON_ERROR_STOP=1 \
  -f prepare.sql -c "set session_replication_role = replica" -f data.sql
```

`session_replication_role = replica` apaga por un momento los *triggers* y los controles de claves foráneas, para que el orden de carga no importe y no se pisen las fechas de `updated_at`. Si algo falla, no se carga nada (`--single-transaction`) y se puede reintentar.

### 5. Reconectar todo al proyecto nuevo

- Supabase nuevo: activar el login con Google (las mismas credenciales de Google Cloud) y las URL de redirección; en Google Cloud, agregar la URL de *callback* del proyecto nuevo.
- Vercel: cambiar las variables de `.env.example` (URL y *publishable key*).
- GitHub: actualizar el secreto `SUPABASE_DB_PASSWORD` y el id del proyecto (`SUPABASE_PROJECT_ID`) y la región (`SUPABASE_REGION`) en los tres workflows.
