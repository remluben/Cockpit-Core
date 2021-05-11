<?php

// Register Helpers
$this->helpers['content'] = 'Content\\Helper\\Content';

// load admin related code
$this->on('app.admin.init', function() {
    include(__DIR__.'/admin.php');
});

// content api
$this->module('content')->extend([

    'createModel' => function(string $name, array $data = []): mixed {

        if (!trim($name)) {
            return false;
        }

        $storagepath = $this->app->path('#storage:').'/content';

        if (!$this->app->path('#storage:content')) {

            if (!$this->app->helper('fs')->mkdir($storagepath)) {
                return false;
            }
        }

        if ($this->exists($name)) {
            return false;
        }

        $time = time();

        $model = array_replace_recursive([
            'name'      => $name,
            'label'     => $name,
            'info'      => '',
            'type'      => 'collection',
            'fields'    => [],
            'group'     => null,
            'sortable'  => false,
            '_created'  => $time,
            '_modified' => $time
        ], $data);

        $export = $this->app->helper('utils')->var_export($model, true);

        if (!$this->app->helper('fs')->write("#storage:content/{$name}.model.php", "<?php\n return {$export};")) {
            return false;
        }

        $this->app->trigger('content.model.create', [$model]);

        return $model;
    },

    'updateModel' => function(string $name, array $data): mixed {

        if (!$this->exists($name)) {
            return false;
        }

        $metapath = $this->app->path("#storage:content/{$name}.model.php");

        if (!$metapath) {
            return false;
        }

        $data['_modified'] = time();

        $model  = include($metapath);
        $model  = array_merge($model, $data);
        $export = $this->app->helper('utils')->var_export($model, true);

        if (!$this->app->helper('fs')->write($metapath, "<?php\n return {$export};")) {
            return false;
        }

        $this->app->trigger('content.update.model', [$model]);
        $this->app->trigger("content.update.model.{$name}", [$model]);

        if (function_exists('opcache_reset')) opcache_reset();

        return $model;
    },

    'saveModel' => function(string $name, array $data): mixed {

        if (!trim($name)) {
            return false;
        }

        return $this->exists($name) ? $this->updateModel($name, $data) : $this->createModel($name, $data);
    },

    'removeModel' => function(string $name): bool {

        $model = $this->model($name);

        if (!$model) {
            return false;
        }

        $this->app->helper('fs')->delete("#storage:content/{$name}.model.php");

        if ($model['type'] == 'singleton') {
            $this->app->dataStorage->remove('content/singletons', ['_model' => $name]);
        } elseif ($model['type'] == 'collection') {
            $this->app->dataStorage->dropCollection("content/collections/{$name}");
        }

        $this->app->trigger('content.remove.model', [$name, $model]);

        return true;
    },

    'models' => function(bool $extended = false): array {

        $models = [];

        foreach ($this->app->helper('fs')->ls('*.model.php', '#storage:content') as $path) {

            $store = include($path->getPathName());

            if ($extended) {
                $store['_entriesCount'] = $this->count($store['name']);
            }

            $models[$store['name']] = $store;
        }

        ksort($models);

        return $models;
    },

    'exists' => function(string $name): ?string {
        return $this->app->path("#storage:content/{$name}.model.php");
    },

    'model' => function(string $name): mixed {

        static $models; // cache

        if (is_null($models)) {
            $models = [];
        }

        if (!isset($models[$name])) {

            $models[$name] = false;

            if ($path = $this->exists($name)) {
                $models[$name] = include($path);
            }
        }

        return $models[$name];
    },

    'getDefaultModelItem' => function(string $model): array {

        $item = [];
        $model = $this->model($model);

        if (!$model) {
            return $item;
        }

        $fields = $model['fields'];
        $locales = $this->app->helper('locales')->locales();

        foreach ($fields as $field) {

            $name = $field['name'];
            $default = $field['opts']['default'] ?? null;
            $multiple = $field['multiple'] ?? false;
            $i18n = $field['i18n'] ?? false;

            $item[$name] = $multiple ? ($default ?? []) : ($default ?? null);

            if ($i18n) {

                foreach ($locales as $locale) {
                    if ($locale['i18n'] == 'default') continue;
                    $localeName = "{$name}_{$locale['i18n']}";
                    $locDefault = $field['opts']["default_{$locale['i18n']}"] ?? null;
                    $item[$localeName] = $multiple ? ($locDefault ?? []) : ($locDefault ?? null);
                }
            }
        }

        return $item;
    },

    'saveItem' => function(string $modelName, array $item): ?array {

        $model = $this->model($modelName);

        if (!$model) {
            throw new Exception('Try to access unknown model "'.$modelName.'"');
        }

        $time = time();
        $default = $this->getDefaultModelItem($modelName);
        $keys = array_keys($default);
        $isUpdate = false;

        $collection = null;

        if ($model['type'] == 'singleton') {

            $collection = 'content/singletons';
            $current = $this->app->dataStorage->findOne('content/singletons', ['_model' => $modelName]);

            if (!$current) {
                $current = $default;
                $current['_model'] = $modelName;
                $current['_created'] = $time;
            } else {
                $isUpdate = true;
            }

            $item = array_merge($current, $item);

        } elseif ($model['type'] == 'collection') {

            $collection = "content/collections/{$modelName}";
            $item = array_merge($default, $item);

            if (!isset($item['_id'])) {
                $current['_created'] = $time;
            } else {
                $isUpdate = true;
            }

        }

        $item['_modified'] = $time;

        if (!$collection) {
            return null;
        }

        $this->app->dataStorage->save($collection, $item);

        return $item;
    },

    'item' => function(string $modelName, array $filter = []) {

        $model = $this->model($modelName);

        if (!$model) {
            throw new Exception('Try to access unknown model "'.$modelName.'"');
        }

        if ($model['type'] == 'singleton') {

            $item = $this->app->dataStorage->findOne('content/singletons', ['_model' => $modelName]);

            if (!$item) {
                $item = $this->getDefaultModelItem($modelName);
            }

            $item['_model'] = $modelName;

        } elseif ($model['type'] == 'collection') {

            $collection = "content/collections/{$modelName}";
            $item = $this->app->dataStorage->findOne($collection, $filter);
        }

        return $item;
    },

    'items' => function(string $modelName, array $options = []): array {

        $model = $this->model($modelName);

        if (!$model) {
            throw new Exception('Try to access unknown model "'.$modelName.'"');
        }

        if ($model['type'] != 'collection') {
            return [];
        }

        $collection = "content/collections/{$modelName}";

        $items = (array) $this->app->dataStorage->find($collection, $options);

        return $items;
    },

    'remove' => function(string $modelName, array $filter = []) {

        $model = $this->model($modelName);

        if (!$model) {
            throw new Exception('Try to access unknown model "'.$modelName.'"');
        }

        if ($model['type'] == 'singleton') {
            return false;
        }

        $collection = "content/collections/{$modelName}";

        $result = $this->app->dataStorage->remove($collection, $filter);

        return $result;
    },

    'count' => function(string $modelName, array $filter = []): int {

        $model = $this->model($modelName);

        if (!$model) {
            throw new Exception('Try to access unknown model "'.$modelName.'"');
        }

        if ($model['type'] == 'singleton') {
            return 1;
        }

        if ($model['type'] != 'collection') {
            return 1;
        }

        $collection = "content/collections/{$modelName}";

        return $this->app->dataStorage->count($collection, $filter);

    }

]);